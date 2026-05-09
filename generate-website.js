#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2] || 'AI-Native组织橙皮书.md';
const outputFile = process.argv[3] || 'index.html';

let md = fs.readFileSync(path.join(__dirname, inputFile), 'utf8');

// ── Custom blocks → HTML ──────────────────────────────────────────
const BG_MAP = {
  'light-orange': '#FFF3E0', 'orange': '#FF6D00',
  'light-yellow': '#FFFDE7', 'yellow': '#FFF176',
  'light-green':  '#E8F5E9', 'green': '#388E3C',
  'light-red':    '#FFEBEE', 'red': '#D32F2F',
  'light-blue':   '#E3F2FD', 'blue': '#1565C0',
  'light-purple': '#F3E5F5', 'purple': '#6A1B9A',
  'pale-gray':    '#F5F5F5', 'light-gray': '#EEEEEE', 'dark-gray': '#9E9E9E',
};
const BORDER_MAP = {
  'light-orange': '#FF9800', 'orange': '#FF6D00',
  'light-yellow': '#F9A825', 'yellow': '#F9A825',
  'light-green':  '#2E7D32', 'green': '#2E7D32',
  'light-red':    '#C62828', 'red': '#C62828',
  'light-blue':   '#1565C0', 'blue': '#1565C0',
  'pale-gray':    '#BDBDBD', 'light-gray': '#BDBDBD', 'dark-gray': '#757575',
};
const EMOJI_MAP = {
  balloon: '🎈', memo: '📝', fire: '🔥', bulb: '💡', warning: '⚠️',
  speech_balloon: '💬', zap: '⚡', red_circle: '🔴', x: '❌',
  white_check_mark: '✅', chart_increasing: '🏢', palm_tree: '🌴',
  orange_heart: '🧡',
};

md = md.replace(
  /<callout emoji="([^"]*)" background-color="([^"]*)">([\s\S]*?)<\/callout>/g,
  (_, emoji, bg, inner) => {
    const bgColor = BG_MAP[bg] || '#FFF3E0';
    const borderColor = BORDER_MAP[bg] || '#FF9800';
    const emojiChar = EMOJI_MAP[emoji] || '📌';
    return `<div class="callout" style="background:${bgColor};border-left:4px solid ${borderColor}"><span class="callout-emoji">${emojiChar}</span><div class="callout-body">${inner.trim()}</div></div>`;
  }
);

md = md.replace(/<grid cols="(\d+)">([\s\S]*?)<\/grid>/g, (_, cols, inner) => {
  const columns = inner.split(/<column[^>]*>/).slice(1).map(c =>
    `<div class="col">${c.replace(/<\/column>[\s\S]*$/, '').trim()}</div>`
  );
  return `<div class="grid grid-${cols}">${columns.join('')}</div>`;
});

// ── Markdown → HTML with navigation extraction ───────────────────
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
  text = text.replace(/<u>(.+?)<\/u>/g, '<u>$1</u>');
  text = text.replace(/<text[^>]*color="([^"]*)"[^>]*>(.+?)<\/text>/g, '<span style="color:$1">$2</span>');
  return text;
}

function slugify(text) {
  return text
    .replace(/§(\d+)/, 'section-$1')
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

const lines = md.split('\n');
let html = '';
let navItems = [];
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
  html += '<div class="table-wrapper"><table>\n';
  tableRows.forEach((row, i) => {
    const tag = i === 0 ? 'th' : 'td';
    const cells = row.replace(/^\||\|$/g, '').split('|').map(c => `<${tag}>${inlineFormat(c.trim())}</${tag}>`).join('');
    if (row.match(/^[\s|:-]+$/)) return;
    html += `<tr>${cells}</tr>\n`;
  });
  html += '</table></div>\n';
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

  if (line.startsWith('<div class="callout"') || line.startsWith('<div class="grid') ||
      line.startsWith('<span class=') || /^<\/div>/.test(line.trim())) {
    flushTable(); flushList(); flushBq();
    html += line + '\n';
    continue;
  }

  const hMatch = line.match(/^(#{1,6})\s+(.*)/);
  if (hMatch) {
    flushTable(); flushList(); flushBq();
    const level = hMatch[1].length;
    const rawText = hMatch[2].replace(/\s*\{[^}]*\}/, '');
    const text = inlineFormat(rawText);
    const id = slugify(rawText);

    if (level <= 3) {
      let type = 'other';
      if (rawText.startsWith('Part ')) type = 'part';
      else if (rawText.match(/^§\d+/)) type = 'section';
      else if (rawText.match(/^### /)) type = 'subsection';
      else if (rawText.match(/^附录/)) type = 'appendix';

      navItems.push({ level, text: rawText, id, type });
      html += `<h${level} id="${id}">${text}</h${level}>\n`;
    } else {
      html += `<h${level} id="${id}">${text}</h${level}>\n`;
    }
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
    continue;
  }
  flushTable(); flushList(); flushBq();
  html += `<p>${inlineFormat(line)}</p>\n`;
}
flushTable(); flushList(); flushBq(); flushCode();

// ── Build navigation HTML ─────────────────────────────────────────
function buildNav(items) {
  let nav = '';
  for (const item of items) {
    if (item.type === 'part') {
      nav += `<div class="nav-part"><a href="#${item.id}">${item.text}</a></div>\n`;
    } else if (item.type === 'section' || item.type === 'appendix') {
      nav += `<div class="nav-section"><a href="#${item.id}">${item.text}</a></div>\n`;
    } else if (item.type === 'subsection' && item.level === 3) {
      nav += `<div class="nav-subsection"><a href="#${item.id}">${item.text}</a></div>\n`;
    }
  }
  return nav;
}

const navHtml = buildNav(navItems);

// ── Build final HTML ──────────────────────────────────────────────
const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Native 组织 橙皮书</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏢</text></svg>">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=Inter:wght@400;500;600;700&display=swap');

  :root {
    --orange: #F57C00;
    --orange-dark: #E65100;
    --orange-light: #FFF3E0;
    --orange-border: #FF9800;
    --text: #212121;
    --text-secondary: #616161;
    --text-muted: #9E9E9E;
    --bg: #FAFAFA;
    --bg-white: #FFFFFF;
    --divider: #E0E0E0;
    --sidebar-width: 300px;
    --header-height: 56px;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  html {
    scroll-behavior: smooth;
    scroll-padding-top: 76px;
  }

  body {
    font-family: 'Noto Sans SC', 'PingFang SC', 'Inter', -apple-system, sans-serif;
    font-size: 16px;
    line-height: 1.8;
    color: var(--text);
    background: var(--bg);
  }

  .header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: var(--header-height);
    background: #1a1a1a;
    color: white;
    display: flex;
    align-items: center;
    padding: 0 24px;
    z-index: 1000;
  }
  .menu-toggle {
    display: none;
    background: none;
    border: none;
    color: white;
    font-size: 22px;
    cursor: pointer;
    padding: 4px 8px 4px 0;
  }
  .header-title {
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 0.3px;
  }
  .header-right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .header-badge {
    font-size: 11px;
    background: rgba(255,255,255,0.12);
    padding: 3px 10px;
    border-radius: 10px;
    letter-spacing: 0.3px;
    color: rgba(255,255,255,0.8);
  }

  .sidebar {
    position: fixed;
    top: var(--header-height);
    left: 0;
    bottom: 0;
    width: var(--sidebar-width);
    background: var(--bg-white);
    border-right: 1px solid var(--divider);
    overflow-y: auto;
    padding: 16px 0;
    z-index: 900;
    transition: transform 0.3s ease;
  }
  .sidebar::-webkit-scrollbar { width: 4px; }
  .sidebar::-webkit-scrollbar-thumb { background: #CCC; border-radius: 2px; }

  .sidebar-search {
    padding: 0 16px 12px;
  }
  .sidebar-search input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--divider);
    border-radius: 6px;
    font-size: 13px;
    font-family: inherit;
    outline: none;
    background: var(--bg);
    color: var(--text);
    transition: border-color 0.15s;
  }
  .sidebar-search input:focus {
    border-color: var(--orange);
    background: white;
  }
  .sidebar-search input::placeholder {
    color: var(--text-muted);
  }

  .nav-part {
    font-weight: 700;
    font-size: 12px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    padding: 16px 20px 6px;
  }
  .nav-part a {
    color: var(--text-muted);
    text-decoration: none;
  }
  .nav-part a:hover { color: var(--orange); }

  .nav-section {
    font-size: 14px;
    padding: 2px 16px;
  }
  .nav-section a {
    color: var(--text);
    text-decoration: none;
    display: block;
    padding: 5px 12px;
    border-radius: 6px;
    transition: all 0.15s;
    font-weight: 400;
  }
  .nav-section a:hover {
    background: var(--orange-light);
    color: var(--orange);
  }
  .nav-section.active a {
    background: var(--orange-light);
    color: var(--orange);
    font-weight: 600;
  }

  .nav-subsection {
    font-size: 13px;
    padding: 1px 16px 1px 32px;
  }
  .nav-subsection a {
    color: var(--text-secondary);
    text-decoration: none;
    display: block;
    padding: 3px 12px;
    border-radius: 6px;
    transition: all 0.15s;
  }
  .nav-subsection a:hover {
    color: var(--orange);
    background: var(--orange-light);
  }
  .nav-subsection.active a {
    color: var(--orange);
    font-weight: 500;
  }

  .main {
    margin-left: var(--sidebar-width);
    margin-top: var(--header-height);
    padding: 40px 56px 80px;
    max-width: 880px;
  }

  .cover {
    background: linear-gradient(135deg, #FF6D00 0%, #FF9800 40%, #FFB74D 100%);
    color: white;
    padding: 56px 40px;
    border-radius: 12px;
    margin-bottom: 40px;
  }
  .cover-tag {
    font-size: 11px;
    letter-spacing: 4px;
    text-transform: uppercase;
    opacity: 0.8;
    margin-bottom: 16px;
    border: 1px solid rgba(255,255,255,0.4);
    display: inline-block;
    padding: 4px 12px;
    border-radius: 3px;
  }
  .cover-title {
    font-size: 36px;
    font-weight: 700;
    line-height: 1.3;
    margin-bottom: 10px;
  }
  .cover-subtitle {
    font-size: 16px;
    opacity: 0.85;
    margin-bottom: 32px;
    font-weight: 400;
  }
  .cover-meta {
    font-size: 13px;
    opacity: 0.75;
    line-height: 2.2;
    border-top: 1px solid rgba(255,255,255,0.3);
    padding-top: 16px;
  }
  .cover-meta strong { opacity: 1; font-weight: 500; }

  h1 {
    font-size: 26px;
    font-weight: 700;
    color: var(--orange);
    margin: 48px 0 16px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--orange);
    scroll-margin-top: 76px;
  }
  h1:first-of-type { margin-top: 0; }

  h2 {
    font-size: 20px;
    font-weight: 700;
    color: var(--text);
    margin: 36px 0 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--divider);
    scroll-margin-top: 76px;
  }

  h3 {
    font-size: 17px;
    font-weight: 700;
    color: #424242;
    margin: 24px 0 8px;
    scroll-margin-top: 76px;
  }

  h4 {
    font-size: 15px;
    font-weight: 700;
    color: #616161;
    margin: 16px 0 8px;
  }

  p { margin: 0 0 12px; }

  strong { font-weight: 700; }
  em { font-style: italic; }

  code {
    font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
    font-size: 13px;
    background: #F5F5F5;
    padding: 2px 6px;
    border-radius: 4px;
    color: #E64A19;
  }

  pre {
    background: #1e1e2e;
    color: #cdd6f4;
    padding: 20px 24px;
    border-radius: 8px;
    margin: 16px 0;
    overflow-x: auto;
    font-size: 13px;
    line-height: 1.65;
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
    margin: 32px 0;
  }

  blockquote {
    border-left: 3px solid var(--orange-border);
    padding: 12px 16px;
    margin: 16px 0;
    color: var(--text-secondary);
    font-style: italic;
    background: var(--orange-light);
    border-radius: 0 6px 6px 0;
  }

  a {
    color: var(--orange);
    text-decoration: none;
    transition: color 0.15s;
  }
  a:hover {
    color: var(--orange-dark);
    text-decoration: underline;
  }

  .table-wrapper {
    overflow-x: auto;
    margin: 16px 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  th {
    background: var(--orange);
    color: white;
    padding: 10px 14px;
    text-align: left;
    font-weight: 600;
    font-size: 13px;
    white-space: nowrap;
  }
  td {
    padding: 10px 14px;
    border-bottom: 1px solid #EEEEEE;
    vertical-align: top;
  }
  tr:nth-child(even) td { background: #FAFAFA; }
  tr:hover td { background: var(--orange-light); }

  ul, ol {
    margin: 8px 0 12px 24px;
    padding-left: 16px;
  }
  li { margin-bottom: 6px; }

  .callout {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px 20px;
    border-radius: 8px;
    margin: 16px 0;
  }
  .callout-emoji {
    font-size: 20px;
    line-height: 1.5;
    flex-shrink: 0;
  }
  .callout-body {
    flex: 1;
    font-size: 14px;
    line-height: 1.7;
  }
  .callout-body p { margin-bottom: 6px; }
  .callout-body p:last-child { margin-bottom: 0; }
  .callout-body strong { font-weight: 700; }
  .callout-body table { margin: 8px 0; }

  .grid {
    display: flex;
    gap: 16px;
    margin: 16px 0;
  }
  .grid-2 .col, .grid-3 .col { flex: 1; }
  .col { min-width: 0; }
  .col p { margin-bottom: 8px; }

  .back-to-top {
    position: fixed;
    bottom: 32px;
    right: 32px;
    width: 44px;
    height: 44px;
    background: var(--orange);
    color: white;
    border: none;
    border-radius: 50%;
    font-size: 20px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.3s;
    z-index: 800;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .back-to-top.visible {
    opacity: 1;
    transform: translateY(0);
  }
  .back-to-top:hover {
    background: var(--orange-dark);
    transform: translateY(-2px);
  }

  .overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 850;
  }

  .footer {
    text-align: center;
    padding: 32px 0;
    color: var(--text-muted);
    font-size: 13px;
    border-top: 1px solid var(--divider);
    margin-top: 48px;
  }

  @media (max-width: 768px) {
    .menu-toggle { display: block; }

    .sidebar {
      transform: translateX(-100%);
      width: 280px;
      box-shadow: 2px 0 12px rgba(0,0,0,0.1);
    }
    .sidebar.open {
      transform: translateX(0);
    }
    .overlay.open { display: block; }

    .main {
      margin-left: 0;
      padding: 24px 16px 60px;
    }

    .cover {
      padding: 32px 24px;
    }
    .cover-title { font-size: 28px; }

    .back-to-top {
      bottom: 20px;
      right: 20px;
      width: 40px;
      height: 40px;
    }
  }
</style>
</head>
<body>

<header class="header">
  <button class="menu-toggle" onclick="toggleSidebar()">☰</button>
  <span class="header-title">AI Native 组织 橙皮书</span>
  <div class="header-right">
    <span class="header-badge">v1.0</span>
    <span class="header-badge">滔哥</span>
  </div>
</header>

<div class="overlay" onclick="toggleSidebar()"></div>

<nav class="sidebar" id="sidebar">
  <div class="sidebar-search">
    <input type="text" placeholder="搜索章节..." id="searchInput" oninput="filterNav(this.value)">
  </div>
  ${navHtml}
</nav>

<main class="main">

<div class="cover">
  <div class="cover-tag">Orange Paper · 橙皮书</div>
  <h1 class="cover-title" style="border:none;color:white;margin:0;padding:0;">AI Native 组织 橙皮书</h1>
  <div class="cover-subtitle">从"用AI"到"长在AI上"，重新定义企业组织</div>
  <div class="cover-meta">
    <strong>版本</strong>：v1.0<br>
    <strong>作者</strong>：滔哥<br>
    <strong>为谁创建</strong>：CEO、CTO、HR负责人、组织变革推动者<br>
    <strong>基于</strong>：YC AI Native Playbook / 传神实践 / a16z / McKinsey<br>
    <strong>最后更新</strong>：2026年5月9日
  </div>
</div>

${html}

<div class="footer">
  AI Native 组织 橙皮书 · v1.0 · 滔哥 · 2026年5月9日
</div>

</main>

<button class="back-to-top" onclick="window.scrollTo({top:0})">↑</button>

<script>
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.querySelector('.overlay').classList.toggle('open');
}

document.querySelectorAll('.sidebar a').forEach(a => {
  a.addEventListener('click', () => {
    if (window.innerWidth <= 768) toggleSidebar();
  });
});

function filterNav(query) {
  const q = query.toLowerCase().trim();
  const items = document.querySelectorAll('.nav-part, .nav-section, .nav-subsection');
  if (!q) {
    items.forEach(el => el.style.display = '');
    return;
  }
  items.forEach(el => {
    const text = el.textContent.toLowerCase();
    el.style.display = text.includes(q) ? '' : 'none';
  });
}

const btn = document.querySelector('.back-to-top');
window.addEventListener('scroll', () => {
  btn.classList.toggle('visible', window.scrollY > 400);
});

const navLinks = document.querySelectorAll('.nav-section, .nav-subsection');
const sections = [];
navLinks.forEach(link => {
  const a = link.querySelector('a');
  if (a) {
    const id = a.getAttribute('href').slice(1);
    const el = document.getElementById(id);
    if (el) sections.push({ el, link });
  }
});

function updateActiveNav() {
  const scrollY = window.scrollY + 100;
  let current = null;
  for (const s of sections) {
    if (s.el.offsetTop <= scrollY) current = s;
  }
  navLinks.forEach(l => l.classList.remove('active'));
  if (current) {
    current.link.classList.add('active');
    current.link.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

let ticking = false;
window.addEventListener('scroll', () => {
  if (!ticking) {
    requestAnimationFrame(() => { updateActiveNav(); ticking = false; });
    ticking = true;
  }
});
updateActiveNav();
</script>

</body>
</html>`;

const outPath = path.join(__dirname, outputFile);
fs.writeFileSync(outPath, fullHtml);
const size = fs.statSync(outPath).size;
console.log(`✓ Website generated: ${outPath} (${(size/1024).toFixed(0)} KB)`);
