#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const inputFile = 'AI-Native组织橙皮书.md';
const outputPdf = 'AI-Native组织橙皮书.pdf';
const tmpHtml = path.join(__dirname, '_tmp_ai_native_book.html');

let md = fs.readFileSync(path.join(__dirname, inputFile), 'utf8');

// ── Markdown → HTML ─────────────────────────────────────────────
function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function inlineFormat(text) {
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');
  return text;
}

const lines = md.split('\n');
let html = '';
let inTable = false;
let tableRows = [];
let inList = false;
let listItems = [];
let listOrdered = false;
let inBlockquote = false;
let bqLines = [];
let inCodeBlock = false;
let codeLines = [];
let codeLang = '';

function flushTable() {
  if (!tableRows.length) return;
  html += '<table>\n';
  tableRows.forEach((row, i) => {
    if (row.match(/^[\s|:-]+$/)) return;
    const tag = i === 0 ? 'th' : 'td';
    const cells = row.replace(/^\||\|$/g, '').split('|').map(c => `<${tag}>${inlineFormat(c.trim())}</${tag}>`).join('');
    html += `<tr>${cells}</tr>\n`;
  });
  html += '</table>\n';
  tableRows = [];
  inTable = false;
}
function flushList() {
  if (!listItems.length) return;
  const tag = listOrdered ? 'ol' : 'ul';
  html += `<${tag}>\n${listItems.map(i => `<li>${inlineFormat(i || '')}</li>`).join('\n')}\n</${tag}>\n`;
  listItems = [];
  inList = false;
}
function flushBq() {
  if (!bqLines.length) return;
  html += `<blockquote>${inlineFormat(bqLines.join('<br>'))}</blockquote>\n`;
  bqLines = [];
  inBlockquote = false;
}
function flushCode() {
  if (!codeLines.length) return;
  const escaped = escapeHtml(codeLines.join('\n'));
  html += `<pre><code class="language-${codeLang}">${escaped}</code></pre>\n`;
  codeLines = [];
  inCodeBlock = false;
  codeLang = '';
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (line.trim().startsWith('```')) {
    if (!inCodeBlock) {
      flushTable(); flushList(); flushBq();
      inCodeBlock = true;
      codeLang = line.trim().replace(/^```/, '').trim() || 'text';
    } else {
      flushCode();
    }
    continue;
  }
  if (inCodeBlock) {
    codeLines.push(line);
    continue;
  }

  const hMatch = line.match(/^(#{1,6})\s+(.*)/);
  if (hMatch) {
    flushTable(); flushList(); flushBq();
    const level = hMatch[1].length;
    const text = inlineFormat(hMatch[2].replace(/\s*\{[^}]*\}/, ''));
    html += `<h${level}>${text}</h${level}>\n`;
    continue;
  }
  if (/^---+$/.test(line.trim())) {
    flushTable(); flushList(); flushBq();
    html += '<hr>\n';
    continue;
  }
  if (/^\|/.test(line)) {
    flushList(); flushBq();
    inTable = true;
    tableRows.push(line);
    continue;
  } else if (inTable) {
    flushTable();
  }
  const olMatch = line.match(/^(\d+)\.\s+(.*)/);
  if (olMatch) {
    flushBq();
    if (!inList || !listOrdered) { flushList(); inList = true; listOrdered = true; }
    listItems.push(olMatch[2]);
    continue;
  }
  const ulMatch = line.match(/^[-*]\s+(.*)/);
  if (ulMatch) {
    flushBq();
    if (!inList || listOrdered) { flushList(); inList = true; listOrdered = false; }
    listItems.push(ulMatch[1]);
    continue;
  }
  if (inList && line.trim() === '') {
    flushList();
    continue;
  }
  const bqMatch = line.match(/^>\s*(.*)/);
  if (bqMatch) {
    flushList();
    inBlockquote = true;
    bqLines.push(bqMatch[1]);
    continue;
  } else if (inBlockquote) {
    flushBq();
  }
  if (line.trim() === '') {
    flushTable(); flushList(); flushBq();
    html += '<p class="spacer"></p>\n';
    continue;
  }
  flushTable(); flushList(); flushBq();
  html += `<p>${inlineFormat(line)}</p>\n`;
}
flushTable(); flushList(); flushBq(); flushCode();

// ── Build final HTML ──────────────────────────────────────────────
const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Native 组织 橙皮书</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap');

  :root {
    --orange: #F57C00;
    --orange-light: #FFF3E0;
    --orange-border: #FF9800;
    --text: #212121;
    --text-secondary: #616161;
    --divider: #E0E0E0;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    font-size: 10pt;
    line-height: 1.75;
    color: var(--text);
    background: #fff;
    padding: 0;
  }

  .cover {
    width: 100%;
    min-height: 100vh;
    background: linear-gradient(135deg, #FF6D00 0%, #FF9800 40%, #FFB74D 100%);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    padding: 60mm 20mm 40mm 20mm;
    page-break-after: always;
    color: white;
  }
  .cover-tag {
    font-size: 9pt;
    letter-spacing: 4px;
    text-transform: uppercase;
    opacity: 0.8;
    margin-bottom: 8mm;
    border: 1px solid rgba(255,255,255,0.5);
    padding: 3px 10px;
    border-radius: 2px;
  }
  .cover-title {
    font-size: 32pt;
    font-weight: 700;
    line-height: 1.2;
    margin-bottom: 6mm;
    letter-spacing: -0.5px;
  }
  .cover-subtitle {
    font-size: 13pt;
    opacity: 0.85;
    margin-bottom: 20mm;
    font-weight: 400;
  }
  .cover-meta {
    font-size: 9pt;
    opacity: 0.75;
    line-height: 2;
    border-top: 1px solid rgba(255,255,255,0.3);
    padding-top: 6mm;
    width: 100%;
  }
  .cover-meta strong { opacity: 1; font-weight: 500; }

  .toc-page {
    page-break-after: always;
    padding: 20mm 18mm;
  }
  .toc-page h2 {
    font-size: 16pt;
    color: var(--orange);
    margin-bottom: 8mm;
    border-bottom: 2px solid var(--orange);
    padding-bottom: 3mm;
  }
  .toc-part {
    font-weight: 700;
    font-size: 10.5pt;
    color: var(--orange);
    margin: 5mm 0 2mm 0;
  }
  .toc-item {
    font-size: 9.5pt;
    line-height: 2.2;
    color: var(--text);
    padding-left: 5mm;
  }

  .content {
    padding: 15mm 18mm;
    max-width: 174mm;
    margin: 0 auto;
  }

  h1 {
    font-size: 18pt;
    font-weight: 700;
    color: var(--orange);
    margin: 14mm 0 4mm 0;
    padding-bottom: 2mm;
    border-bottom: 2px solid var(--orange);
    page-break-after: avoid;
  }
  h1:first-of-type { margin-top: 6mm; }

  h2 {
    font-size: 14pt;
    font-weight: 700;
    color: var(--text);
    margin: 10mm 0 4mm 0;
    page-break-after: avoid;
    padding-bottom: 1.5mm;
    border-bottom: 1px solid var(--divider);
  }

  h3 {
    font-size: 11pt;
    font-weight: 700;
    color: #424242;
    margin: 6mm 0 2mm 0;
    page-break-after: avoid;
  }

  h4 {
    font-size: 10pt;
    font-weight: 700;
    color: #616161;
    margin: 4mm 0 2mm 0;
  }

  p { margin: 0 0 3mm 0; }
  p.spacer { margin: 1mm 0; }

  strong { font-weight: 700; }
  em { font-style: italic; }
  code {
    font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
    font-size: 8.5pt;
    background: #F5F5F5;
    padding: 1px 4px;
    border-radius: 3px;
    color: #E64A19;
  }

  pre {
    background: #263238;
    color: #EEFFFF;
    padding: 3mm 4mm;
    border-radius: 6px;
    margin: 3mm 0;
    overflow-x: auto;
    page-break-inside: avoid;
    font-size: 8pt;
    line-height: 1.6;
  }
  pre code {
    background: none;
    color: inherit;
    padding: 0;
    font-size: inherit;
  }

  hr {
    border: none;
    border-top: 1px solid var(--divider);
    margin: 8mm 0;
  }

  blockquote {
    border-left: 3px solid var(--orange-border);
    padding: 2mm 4mm;
    margin: 3mm 0;
    color: var(--text-secondary);
    font-style: italic;
    background: var(--orange-light);
    border-radius: 0 4px 4px 0;
  }

  a {
    color: var(--orange);
    text-decoration: none;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 4mm 0;
    font-size: 9pt;
    page-break-inside: avoid;
  }
  th {
    background: var(--orange);
    color: white;
    padding: 2.5mm 3mm;
    text-align: left;
    font-weight: 600;
    font-size: 8.5pt;
  }
  td {
    padding: 2mm 3mm;
    border-bottom: 1px solid #EEEEEE;
    vertical-align: top;
  }
  tr:nth-child(even) td { background: #FAFAFA; }

  ul, ol {
    margin: 2mm 0 3mm 5mm;
    padding-left: 5mm;
  }
  li { margin-bottom: 1.5mm; }

  @media print {
    body { background: white; }
    h1 { page-break-before: always; }
    h1:first-of-type { page-break-before: avoid; }
    .cover { page-break-after: always; }
    table { page-break-inside: avoid; }
    pre { page-break-inside: avoid; }

    @page {
      size: A4;
      margin: 15mm 18mm 18mm 18mm;
    }
    @page :first {
      margin: 0;
    }
  }
</style>
</head>
<body>

<div class="cover">
  <div class="cover-tag">Orange Paper · 橙皮书</div>
  <div class="cover-title">AI Native 组织<br>橙皮书</div>
  <div class="cover-subtitle">从"用AI"到"长在AI上"，重新定义企业组织</div>
  <div class="cover-meta">
    <strong>版本</strong>：v1.0-专业版<br>
    <strong>作者</strong>：滔哥<br>
    <strong>为谁创建</strong>：CEO、CTO、HR负责人、组织变革推动者<br>
    <strong>基于</strong>：YC AI Native Playbook / Anthropic / Atlassian / François Lane<br>
    <strong>最后更新</strong>：2026-05-16
  </div>
</div>

<div class="toc-page">
  <h2>目录</h2>
  <div class="toc-part">Part 1: 认识 AI Native</div>
  <div class="toc-item">§01 AI Native的定义与边界</div>
  <div class="toc-item">§02 技术底座</div>
  <div class="toc-item">§03 AI Native vs 传统组织</div>

  <div class="toc-part">Part 2: 组织重构</div>
  <div class="toc-item">§04 CAIO：首席智能官</div>
  <div class="toc-item">§05 从部门制到Agent制</div>
  <div class="toc-item">§06 AI联合舰队</div>
  <div class="toc-item">§07 人才标准</div>

  <div class="toc-part">Part 3: 工作流再造</div>
  <div class="toc-item">§08 智能决策本能化</div>
  <div class="toc-item">§09 业务流与数据流合一</div>
  <div class="toc-item">§10 知识沉淀</div>
  <div class="toc-item">§11 会议与沟通的AI原生改造</div>

  <div class="toc-part">Part 4: 产品AI Native化</div>
  <div class="toc-item">§12 设计原则</div>
  <div class="toc-item">§13 从功能驱动到智能驱动</div>
  <div class="toc-item">§14 用户体验的范式转移</div>
  <div class="toc-item">§15 数据飞轮</div>

  <div class="toc-part">Part 5: 文化与激励</div>
  <div class="toc-item">§16 激励体系</div>
  <div class="toc-item">§17 容错文化</div>
  <div class="toc-item">§18 Token思维</div>

  <div class="toc-part">Part 6: 转型路径</div>
  <div class="toc-item">§19 成熟度评估</div>
  <div class="toc-item">§20 90天转型计划</div>
  <div class="toc-item">§21 常见失败模式</div>
  <div class="toc-item">§22 案例</div>

  <div class="toc-part">Part 7: AI Native 创业实战</div>
  <div class="toc-item">§23 创业生命周期的AI重塑</div>
  <div class="toc-item">§24 创始人角色的转变</div>
  <div class="toc-item">§25 Idea阶段：验证先于构建</div>
  <div class="toc-item">§26 MVP阶段：AI驱动的快速迭代</div>
  <div class="toc-item">§27 Launch阶段：从产品到公司</div>
  <div class="toc-item">§28 Scale阶段：从创始人驱动到系统驱动</div>

  <div class="toc-part">附录</div>
  <div class="toc-item">附录A：AI Native成熟度评估表</div>
  <div class="toc-item">附录B：推荐工具</div>
  <div class="toc-item">附录C：核心概念速查</div>
  <div class="toc-item">附录D：推荐阅读</div>
</div>

<div class="content">
${html}
</div>

</body>
</html>`;

fs.writeFileSync(tmpHtml, fullHtml);
console.log(`HTML generated: ${tmpHtml}`);

// ── Chrome headless → PDF ─────────────────────────────────────────
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const pdfOut = path.join(__dirname, outputPdf);

if (!fs.existsSync(chrome)) {
  console.log('Chrome not found. HTML file saved at:', tmpHtml);
  console.log('You can open it in any browser and print to PDF.');
  process.exit(0);
}

const cmd = `"${chrome}" --headless --disable-gpu --no-sandbox \
  --print-to-pdf="${pdfOut}" \
  --print-to-pdf-no-header \
  --no-pdf-header-footer \
  --run-all-compositor-stages-before-draw \
  "file://${tmpHtml}" 2>&1`;

try {
  execSync(cmd, { stdio: 'pipe', timeout: 120000 });
  const size = fs.statSync(pdfOut).size;
  console.log(`PDF generated: ${pdfOut} (${(size/1024).toFixed(0)} KB)`);
  fs.unlinkSync(tmpHtml);
} catch (e) {
  console.error('Chrome error:', e.message);
  console.log(`HTML file kept at: ${tmpHtml}`);
  process.exit(1);
}
