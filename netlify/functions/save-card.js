// save-card.js
// Netlify Function: persists a generated card to the corporatecirc.us GitHub repo
// at cards/{timestamp}-{slug}.json. Uses the GitHub Contents API (PUT).
//
// Requires the env var GITHUB_TOKEN — a Personal Access Token with Contents:write
// permission scoped to the corporatecirc.us repository.

const REPO_OWNER = 'kellyorkin';
const REPO_NAME = 'corporatecirc.us';
const REPO_BRANCH = 'main';
const CARDS_DIR = 'cards';

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'card';
}

function timestamp() {
  // YYYY-MM-DD-HHmmss in UTC
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return [
    d.getUTCFullYear(),
    pad(d.getUTCMonth() + 1),
    pad(d.getUTCDate())
  ].join('-') + '-' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds());
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'GITHUB_TOKEN not set in Netlify environment variables.' })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON in request body.' })
    };
  }

  const card = body.card;
  if (!card || typeof card !== 'object' || !card.name) {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'card.name is required.' })
    };
  }

  const slug = slugify(card.name);
  const filename = `${timestamp()}-${slug}.json`;
  const path = `${CARDS_DIR}/${filename}`;

  // Default new cards to "draft" status. The render pipeline will
  // pick them up, render them onto the appropriate venue page,
  // and flip status to "published" via PR.
  // State transitions are owned by the renderer, not the saver.
  if (!card.status) {
    card.status = 'draft';
  }

  const cardJson = JSON.stringify(card, null, 2) + '\n';
  const encodedContent = Buffer.from(cardJson, 'utf-8').toString('base64');
  const githubUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;

  try {
    const response = await fetch(githubUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'flea-circus-card-saver'
      },
      body: JSON.stringify({
        message: `Add card: ${card.name}`,
        content: encodedContent,
        branch: REPO_BRANCH
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        statusCode: response.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `GitHub API error: ${errorText}` })
      };
    }

    const data = await response.json();
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        path,
        url: data.content && data.content.html_url ? data.content.html_url : null,
        sha: data.content && data.content.sha ? data.content.sha : null
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Server error: ${err.message}` })
    };
  }
};
