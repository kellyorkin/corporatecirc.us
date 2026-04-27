# The Product Flea Circus — Card Generator (V1)

A small web app that takes a marketing-tech concept name and returns a Manufactured Exhibit card in The Product Flea Circus voice.

It's a single HTML form on the front, a Netlify serverless function on the back, and one call to the Claude API in the middle.

---

## What's in this folder

```
flea-circus-generator-app/
├── index.html                       ← The form + card renderer
├── netlify.toml                     ← Netlify config
├── netlify/
│   └── functions/
│       └── generate-card.js         ← Serverless function (calls Claude)
└── README.md                        ← You are here
```

---

## Prerequisites

You will need three things, none of which require coding:

1. **A GitHub repository** — either your existing `indifferencer.com` repo or a new one. The files in this folder need to live there.
2. **A Netlify account** — free tier is fine. [netlify.com](https://www.netlify.com) → Sign up with GitHub.
3. **An Anthropic API key** — [console.anthropic.com](https://console.anthropic.com) → Settings → API Keys → Create Key. Copy it somewhere safe; you'll paste it into Netlify in a moment. **Do not commit it to your repo.**

---

## Deployment — first time setup

### 1. Drop the files into your repo

You have two options:

- **Standalone site:** create a new GitHub repo (e.g., `flea-circus-generator`), commit *all* the files in this folder to its root, and connect Netlify to that repo.
- **Sub-page on indifferencer.com:** put the contents in a subfolder of your existing repo (e.g., `flea-circus/`). The function will still work because Netlify Functions live at the repo level regardless of where the static files are. You may need to adjust `netlify.toml`'s `publish` field if you already have one — see the comments in that file.

### 2. Connect the repo to Netlify

In Netlify: **Add new site → Import an existing project → GitHub → pick your repo → Deploy site.**

Netlify will auto-detect `netlify.toml` and configure itself. The first deploy will succeed but the form won't work yet, because the API key isn't set.

### 3. Add your Anthropic API key

In Netlify, on your site's dashboard:

**Site settings → Environment variables → Add a variable**

- Key: `ANTHROPIC_API_KEY`
- Value: `sk-ant-api03-...` (paste the key from console.anthropic.com)
- Scopes: Functions (default is fine)

Save. Then **Deploys → Trigger deploy → Deploy site** to redeploy with the new environment variable available.

### 4. Open the site

Netlify gives you a URL like `https://thoughtful-curie-9a1b2c.netlify.app` (or you can rename it). Open it. Fill in the form. Submit. A card should appear.

---

## How to use it

1. **Concept** (required) — any marketing-tech phenomenon: a feature name, an acronym, a corporate role, a phrase you heard in a meeting that bothered you. Examples that work well:
   - `Customer 360`
   - `Reverse ETL`
   - `Predictive Send Time`
   - `Single Source of Truth`
   - `Compliance Audit`
   - `Personalization Engine`

2. **Sub-tent** (optional) — pick one of the existing tents if the concept clearly fits, or leave blank and the model will choose. Pick `other` if it's a meetings/calendar/organizational concept that doesn't fit the existing tents (the model will name a new tent).

3. **OSI Layer** (optional) — defaults to whatever the model chooses. Manufactured Exhibits are usually Layer 7 (Application). Leave blank unless you want to force a particular layer for satirical effect.

4. Hit **Generate Card.** The card renders below the form with a "View raw JSON" expander if you want to copy the structured data.

---

## Tuning the voice

If a generated card feels off — too generic, wrong tone, missing the satirical bite — the fix is almost always **adding stronger few-shot examples**, not rewriting the system prompt.

To add a new few-shot example:

1. Generate cards until you get one you love.
2. Copy its JSON (use the "View raw JSON" expander).
3. Open `netlify/functions/generate-card.js`.
4. Find the `FEW_SHOT_MESSAGES` array.
5. Add a new pair (user message + assistant tool_use) at the end of the array, modeled on the existing examples.
6. Commit and push. Netlify auto-redeploys.

The model will use your additions as anchors for future cards. **The model itself does not learn between calls** — every call is independent. The few-shot array IS the model's voice memory. Curate it deliberately.

---

## Costs

Each card generation makes one Claude API call with roughly 3,000 input tokens (system prompt + few-shot) and ~200 output tokens. At Sonnet pricing, that's roughly **$0.012 per card**. 100 cards costs about $1.20. The Anthropic console shows your usage in real time.

---

## Troubleshooting

**"ANTHROPIC_API_KEY not set in Netlify environment variables."**
You need to add the env var (see Step 3) and trigger a redeploy. Existing deploys don't pick up new env vars retroactively.

**The form submits but nothing happens / spinner forever.**
Open browser dev tools → Network tab. Submit again. Click the failed request to see the actual error. Most common: the function path is wrong (the form expects `/.netlify/functions/generate-card`).

**"Claude API error: ..."**
The error text comes back from Anthropic. Most common causes: invalid API key, rate limit hit, or the requested model name is not available on your account. Check the [Anthropic status page](https://status.anthropic.com).

**The card renders but the voice is off.**
This is a tuning problem, not a deployment problem. See "Tuning the voice" above.

---

## Architecture notes (for the curious / cert-prep relevant)

This implementation uses three patterns that show up directly on the Claude Certified Architect exam:

- **Tool use for guaranteed structured output** (Domain 4, Task Statement 4.3). The function defines a `generate_manufactured_exhibit_card` tool with a strict JSON schema, then forces the model to call it via `tool_choice: { type: 'tool', name: '...' }`. This eliminates JSON syntax errors entirely and guarantees the response conforms to the schema.

- **Few-shot prompting for voice consistency** (Domain 4, Task Statement 4.2). The four canonical examples in the prompt are the most effective lever for keeping the model's output in voice — far more effective than rewriting the system prompt rules.

- **Explicit criteria over vague instructions** (Domain 4, Task Statement 4.1). Every voice rule in the system prompt is concrete and demonstrable ("Pattern: '[Action]. This card is considered [adjective].'") rather than abstract ("be satirical"). The exam tests this distinction repeatedly.

When you sit for the cert, you will be reading multiple-choice questions about these exact patterns. You will have built one.

---

## What's not here yet (future iterations)

- Save generated cards to a backing store (right now they're ephemeral)
- Support for Performer and Counter Spell card types (V1 is Manufactured Exhibits only)
- A separate generator for Meetings: The Blathering narrative-vignette cards
- Card art prompt generation paired with the card output
- Multi-pass review (a second model call that critiques the first card and suggests improvements — Domain 4, Task Statement 4.6)

---

## Files in this app

| File | What it does |
|------|--------------|
| `index.html` | The form UI + card renderer + JS that calls the function |
| `netlify/functions/generate-card.js` | The serverless function that calls Claude |
| `netlify.toml` | Tells Netlify where things live |
| `README.md` | This file |
