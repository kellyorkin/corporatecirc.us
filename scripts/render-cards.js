// scripts/render-cards.js
//
// Reads all cards/*.json with status: "draft", renders each as midway-card HTML
// matching the structure documented in midway.html, finds the appropriate
// sub-tent section by ID, appends the rendered card, removes the empty-stall
// placeholder if present, and flips each card's status to "published".
//
// Idempotent against already-published cards: it only processes drafts.
//
// Usage (run from repo root):
//   node scripts/render-cards.js

const fs = require('fs');
const path = require('path');

const CARDS_DIR = path.join(__dirname, '..', 'cards');
const MIDWAY_PATH = path.join(__dirname, '..', 'midway.html');

// ── Helpers ────────────────────────────────────────────────────────────────

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Determine which midway.html section a card belongs in.
// Sub-tent slug usually matches the section ID directly.
// "other" with a custom sub_tent_detail goes to the "emergent-tents" catch-all.
function getSectionId(card) {
  if (card.sub_tent === 'other') return 'emergent-tents';
  return slugify(card.sub_tent);
}

// Render a single card to HTML matching the midway-card template documented
// in midway.html.
function renderCard(card) {
  const clausesHtml = (card.clauses || []).map(c =>
    `    <div class="mc-clause-name">${escapeHtml(c.name)}</div>\n` +
    `    <div>${escapeHtml(c.rule)}</div>`
  ).join('\n');

  const subTentDisplay = card.sub_tent === 'other' && card.sub_tent_detail
    ? `${escapeHtml(card.sub_tent)}: ${escapeHtml(card.sub_tent_detail)}`
    : escapeHtml(card.sub_tent);

  const roleDisplay = card.role
    ? (card.role === 'other' && card.role_detail
        ? `${escapeHtml(card.role)}: ${escapeHtml(card.role_detail)}`
        : escapeHtml(card.role))
    : '';

  const statsHtml = (typeof card.atk === 'number' && typeof card.def === 'number')
    ? `    <div class="mc-stats">ATK ${escapeHtml(card.atk)} / DEF ${escapeHtml(card.def)}</div>\n`
    : '';

  const signHtml = card.image_sign_text
    ? `    <div class="mc-sign">${escapeHtml(card.image_sign_text)}</div>\n`
    : '';

  return `  <div class="midway-card">
    <div class="mc-badge">${escapeHtml(card.card_type)}</div>
    <div class="mc-name">${escapeHtml(card.name)}</div>
    <div class="mc-tagline">— ${escapeHtml(card.role_tagline)} —</div>
${statsHtml}    <div class="mc-effect">${escapeHtml(card.effect)}</div>
${clausesHtml}
    <div class="mc-witness">"${escapeHtml(card.witness_quote)}"</div>
    <div class="mc-translation">
      <div class="mc-translation-obs">${escapeHtml(card.translation_layer.observation)}</div>
      <div class="mc-translation-q">${escapeHtml(card.translation_layer.skeptical_question)}</div>
    </div>
${signHtml}    <div class="mc-meta">
      <span>OSI Layer ${escapeHtml(card.osi_layer)}</span>
      <span>${subTentDisplay}</span>${roleDisplay ? `\n      <span>Role: ${roleDisplay}</span>` : ''}
    </div>
  </div>`;
}

// Find the start and end indices of a card-container section's CONTENT (not the
// surrounding tags). Walks the HTML counting <div> depth so nested divs (like
// the empty-stall) do not confuse the search.
function findSectionContent(html, sectionId) {
  const startMarker = `<div class="card-container" id="${sectionId}">`;
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) return null;

  const contentStart = startIdx + startMarker.length;
  let depth = 1;
  let pos = contentStart;

  while (pos < html.length && depth > 0) {
    const nextOpen = html.indexOf('<div', pos);
    const nextClose = html.indexOf('</div>', pos);

    if (nextClose === -1) return null;
    if (nextOpen === -1 || nextClose < nextOpen) {
      depth--;
      if (depth === 0) {
        return { contentStart, contentEnd: nextClose };
      }
      pos = nextClose + '</div>'.length;
    } else {
      depth++;
      pos = nextOpen + '<div'.length;
    }
  }

  return null;
}

// ── Main flow ──────────────────────────────────────────────────────────────

if (!fs.existsSync(CARDS_DIR)) {
  console.error(`No cards directory found at ${CARDS_DIR}`);
  process.exit(1);
}
if (!fs.existsSync(MIDWAY_PATH)) {
  console.error(`No midway.html found at ${MIDWAY_PATH}`);
  process.exit(1);
}

// Load all cards, find drafts.
const files = fs.readdirSync(CARDS_DIR).filter(f => f.endsWith('.json'));
const drafts = [];

for (const file of files) {
  const fullPath = path.join(CARDS_DIR, file);
  try {
    const card = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    if (card.status === 'draft') {
      drafts.push({ file, fullPath, card });
    }
  } catch (err) {
    console.error(`Error reading ${file}: ${err.message}`);
  }
}

if (drafts.length === 0) {
  console.log('No draft cards to render. Exiting cleanly.');
  process.exit(0);
}

console.log(`Found ${drafts.length} draft card(s) to render.`);

// Group drafts by target section ID.
const bySection = {};
for (const draft of drafts) {
  const sectionId = getSectionId(draft.card);
  if (!bySection[sectionId]) bySection[sectionId] = [];
  bySection[sectionId].push(draft);
}

// Read midway.html, insert cards, write back.
let midwayHtml = fs.readFileSync(MIDWAY_PATH, 'utf-8');
const failedSections = [];

for (const [sectionId, sectionDrafts] of Object.entries(bySection)) {
  const range = findSectionContent(midwayHtml, sectionId);
  if (!range) {
    console.warn(`  Section "${sectionId}" not found in midway.html. Skipping ${sectionDrafts.length} card(s).`);
    failedSections.push({ sectionId, count: sectionDrafts.length });
    continue;
  }

  let existingContent = midwayHtml.slice(range.contentStart, range.contentEnd);

  // Strip empty-stall placeholders so the first card replaces the "stall not opened yet" copy.
  existingContent = existingContent.replace(
    /\s*<div class="empty-stall">[\s\S]*?<\/div>\s*/g,
    '\n'
  );

  const newCardsHtml = sectionDrafts.map(d => renderCard(d.card)).join('\n');
  const updatedContent = `${existingContent.trimEnd()}\n${newCardsHtml}\n    `;

  midwayHtml =
    midwayHtml.slice(0, range.contentStart) +
    updatedContent +
    midwayHtml.slice(range.contentEnd);

  console.log(`  Section "${sectionId}": rendered ${sectionDrafts.length} card(s)`);
}

// Write updated midway.html.
fs.writeFileSync(MIDWAY_PATH, midwayHtml);
console.log(`Updated midway.html`);

// Update each successfully-rendered draft card's status to "published".
let publishedCount = 0;
for (const { fullPath, card } of drafts) {
  const sectionId = getSectionId(card);
  const wasFailed = failedSections.some(f => f.sectionId === sectionId);
  if (wasFailed) {
    console.warn(`  Card "${card.name}" left as draft (section "${sectionId}" not found).`);
    continue;
  }
  card.status = 'published';
  fs.writeFileSync(fullPath, JSON.stringify(card, null, 2) + '\n');
  publishedCount++;
}

console.log('');
console.log('Render complete.');
console.log(`  Cards rendered:  ${publishedCount}`);
console.log(`  Cards left draft: ${drafts.length - publishedCount}`);
console.log(`  Updated files:   midway.html + ${publishedCount} card JSON file(s)`);
console.log('');
console.log('Next: review the diff (git diff midway.html cards/), then commit.');
