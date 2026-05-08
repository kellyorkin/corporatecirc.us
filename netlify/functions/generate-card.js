// generate-card.js
// Netlify Function: generates a Manufactured Exhibit card for The Product Flea Circus.
//
// Reads { concept, sub_tent?, role? } from the POST body, calls Claude with the
// V1.1 system prompt + few-shot examples, and returns a schema-compliant JSON card.
//
// Requires the env var ANTHROPIC_API_KEY (set in Netlify UI, NOT in code).
//
// Voice rules, structural rules, alignment grid, stats guidance, and base
// schema fields are shared across decks via netlify/lib/card-voice-rules.
// Flea-Circus-specific bits (game framing, sub-tents, circus roles,
// anti-patterns, image_sign_text, few-shots) live here.

const {
  VOICE_RULES_SHARED,
  STRUCTURAL_RULES_SHARED,
  STATS_GUIDANCE,
  ALIGNMENT_GRID,
  HEAVY_LIFTING_NOTE,
  BASE_SCHEMA_FIELDS
} = require('../lib/card-voice-rules');

const SYSTEM_PROMPT = `You generate Manufactured Exhibit cards for The Product Flea Circus, a satirical card game by Indifferencer, Inc. Your output must be a single card matching the provided tool schema.

THE GAME
The Product Flea Circus satirizes enterprise marketing technology and the rhetorical apparatus around it. Real but operationally modest technical capabilities are narrated into significance by elaborate marketing language. The audience experiences the marketing, not the technology. Functional output remains constant across all stages.

Cards are tagged with a corporate alignment from a 3×3 grid borrowed from the Strategic Acquisition Assessment Division (Indifferencer, Inc.™). The alignment names the posture the card embodies — its relationship to institutional norms and to its own performance.

VOICE RULES
- The card's outward voice is vendor pitch deck: confident, declarative, narrating modest capabilities into transformative ones.
${VOICE_RULES_SHARED}

STRUCTURAL RULES
${STRUCTURAL_RULES_SHARED}
- image_sign_text (optional): A marketing slogan visible in the artwork. Punchy capitals.

SUB-TENTS
- CDP Circus — customer data platforms, identity resolution
- AI Pavilion — AI/ML features and rhetorical infrastructure
- Analytics Arcade — KPIs, dashboards, reporting
- Compliance Sideshow — GDPR, governance, legal infrastructure
- COE Circus — institutional capability theater
- MVP Midway — minimum viable products, half-shipped features, beta launches that became permanent, prematurely-launched capabilities that stayed

ROLES
Every card carries a circus-performer role that shapes its voice and posture. The role may be reflected in the card's name (e.g., "The Risk Assessment Tightrope") or carried implicitly through the clauses' tone. Pick the role whose archetype best fits the phenomenon being satirized.

- Tightrope — precarious balance: risk assessment, compliance, deadlines, anything one slip from collapse
- Strongman — brute-force display: feature launches, demos, "showing strength"
- Sleight of Hand — misdirection: rebrands, KPI gaming, redirecting attention
- Trapeze — risky exchange or leap: acquisitions, pivots, migrations, hand-offs
- Juggler — managing too many things at once: multi-stakeholder projects, sprints, attention division
- Ringmaster — narrating the show: leadership, all-hands, declarations of completion
- Acrobat — flexibility / contortion: agile transformations, scope changes, shape-shifting
- Fire Breather — risk theater / dramatic transformation: innovation labs, moonshots, controlled spectacle of danger
- Magician — illusion: AI hype, vaporware, demos that do not match production
- Clown — truth-telling through humor: dissent, gallows humor, the licensed fool naming the dysfunction
- Contortionist — held in an impossible shape: stuck scope, legacy-bent processes, code that works in ways no one can explain
- Lion Tamer — dominance over a dangerous thing: gatekeeping, executive management, perimeter defense through threat display
- Illusionist — grand-spectacle illusion: sweeping declarations of unification, ceremonial validation, theater at industrial scale
- Fortune Teller — divination without commitment: predictions, prophecies, vendor evaluations dressed as foresight
- Knife Thrower — high-precision risk: surgical layoffs, on-target deadlines, decisive moves where misses are visible

Magic-lane disambiguation (these roles overlap and must stay distinct): Sleight of Hand is small-precise misdirection; Magician is theatrical conjuring of an illusion; Illusionist is grand-spectacle illusion at scale; Fortune Teller is mystical divination of the future.

STATS
${STATS_GUIDANCE}

ALIGNMENT
${ALIGNMENT_GRID}

Most Manufactured Exhibits will lean Performative — these cards satirize how marketing stages technology, and Performative is its native voice. Resist defaulting there. A risk register is Lawful Compliant. A tired re-org is Lawful Resigned. A working pilot is Neutral Engaged. The alignment should sharpen the satire of the specific card, not generalize across the deck.

ANTI-PATTERNS
- Do not exceed 3 clauses.
- Do not pad Translation Layer with corporate language.
- Do not generate Performer or Counter Spell cards. V1 is Manufactured Exhibits only.
- Do not justify the ATK/DEF numbers in any field. They stand without defense.

${HEAVY_LIFTING_NOTE}`;

const TOOL_DEFINITION = {
  name: "generate_manufactured_exhibit_card",
  description: "Return a single Manufactured Exhibit card matching the schema.",
  input_schema: {
    type: "object",
    properties: {
      name: BASE_SCHEMA_FIELDS.name,
      role_tagline: BASE_SCHEMA_FIELDS.role_tagline,
      card_type: { type: "string", enum: ["Manufactured Exhibit"] },
      alignment: BASE_SCHEMA_FIELDS.alignment,
      sub_tent: {
        type: "string",
        enum: ["CDP Circus", "AI Pavilion", "Analytics Arcade", "Compliance Sideshow", "COE Circus", "MVP Midway"]
      },
      role: {
        type: "string",
        enum: ["Tightrope", "Strongman", "Sleight of Hand", "Trapeze", "Juggler", "Ringmaster", "Acrobat", "Fire Breather", "Magician", "Clown", "Contortionist", "Lion Tamer", "Illusionist", "Fortune Teller", "Knife Thrower"],
        description: "Circus-performer archetype shaping the card's voice and posture."
      },
      atk: BASE_SCHEMA_FIELDS.atk,
      def: BASE_SCHEMA_FIELDS.def,
      image_sign_text: {
        type: ["string", "null"],
        description: "Optional marketing slogan visible in artwork. Punchy capitals."
      },
      effect: BASE_SCHEMA_FIELDS.effect,
      clauses: BASE_SCHEMA_FIELDS.clauses,
      witness_quote: BASE_SCHEMA_FIELDS.witness_quote,
      translation_layer: BASE_SCHEMA_FIELDS.translation_layer
    },
    required: ["name", "role_tagline", "card_type", "alignment", "sub_tent", "role", "atk", "def", "effect", "clauses", "witness_quote", "translation_layer"]
  }
};

// Few-shot examples: user/assistant exchanges that demonstrate the schema and voice.
//
// CRITICAL: Claude's API requires every assistant `tool_use` block to be followed
// by a user `tool_result` block in the next message. So each follow-up user message
// here pairs the tool_result (acknowledging the prior card) with the new concept
// in a single message with multiple content blocks. The very last few-shot message
// is an assistant tool_use; the handler appends the final user message (which carries
// the tool_result for that last tool_use plus the actual user-submitted concept).
//
// First three are canonical existing cards (anchoring voice from approved work).
// Fourth is a generated card showing outside-of-ring reach.
const FEW_SHOT_MESSAGES = [
  {
    role: "user",
    content: "Concept: A circus strongman demonstrating exceptional strength.\nSub-tent: COE Circus"
  },
  {
    role: "assistant",
    content: [
      {
        type: "tool_use",
        id: "toolu_example_01",
        name: "generate_manufactured_exhibit_card",
        input: {
          name: "The Strongman",
          role_tagline: "Demonstration of Strength",
          card_type: "Manufactured Exhibit",
          alignment: "Lawful Performative",
          sub_tent: "COE Circus",
          role: "Strongman",
          atk: 8,
          def: 4,
          image_sign_text: "INCREDIBLE STRENGTH! WITNESS!",
          effect: "Demonstrate exceptional strength. This card is considered powerful.",
          clauses: [
            { name: "PERCEPTION CLAUSE", rule: "If the source of support is unclear: The performance is considered valid." },
            { name: "REINFORCEMENT EFFECT", rule: "Each time this card is observed: Increase its perceived strength." }
          ],
          witness_quote: "Remarkable strength.",
          translation_layer: {
            observation: "Small objects stacked.",
            skeptical_question: "...is that a shadow or is it glue?"
          }
        }
      }
    ]
  },
  {
    role: "user",
    content: [
      { type: "tool_result", tool_use_id: "toolu_example_01", content: "Card recorded." },
      { type: "text", text: "Concept: A tightrope walker maintaining balance under uncertain conditions.\nSub-tent: COE Circus" }
    ]
  },
  {
    role: "assistant",
    content: [
      {
        type: "tool_use",
        id: "toolu_example_02",
        name: "generate_manufactured_exhibit_card",
        input: {
          name: "The Tightrope",
          role_tagline: "Balance and Stability",
          card_type: "Manufactured Exhibit",
          alignment: "Lawful Compliant",
          sub_tent: "COE Circus",
          role: "Tightrope",
          atk: 3,
          def: 7,
          image_sign_text: "BALANCED. STEADY. NOTHING TO SEE HERE.",
          effect: "Maintain balance in uncertain conditions. This card is considered stable.",
          clauses: [
            { name: "BALANCE CLAUSE", rule: "If outcomes remain steady: They are considered controlled." },
            { name: "ADAPTATION CLAUSE", rule: "If conditions change: Make small adjustments." }
          ],
          witness_quote: "A delicate balance.",
          translation_layer: {
            observation: "A rope is tight.",
            skeptical_question: "Who is holding that pole?"
          }
        }
      }
    ]
  },
  {
    role: "user",
    content: [
      { type: "tool_result", tool_use_id: "toolu_example_02", content: "Card recorded." },
      { type: "text", text: "Concept: The impressive outcome at the end of a project, where everything is justified after the fact.\nSub-tent: COE Circus" }
    ]
  },
  {
    role: "assistant",
    content: [
      {
        type: "tool_use",
        id: "toolu_example_03",
        name: "generate_manufactured_exhibit_card",
        input: {
          name: "The Grand Finale",
          role_tagline: "Impressive Outcome",
          card_type: "Manufactured Exhibit",
          alignment: "Chaotic Performative",
          sub_tent: "COE Circus",
          role: "Ringmaster",
          atk: 9,
          def: 2,
          image_sign_text: null,
          effect: "Deliver an impressive outcome. All previous actions are justified.",
          clauses: [
            { name: "CELEBRATION CLAUSE", rule: "If the audience applauds: The performance is considered a success." },
            { name: "FORGETFULNESS CLAUSE", rule: "Next turn: No one remembers how it worked." }
          ],
          witness_quote: "What a show!",
          translation_layer: {
            observation: "Confetti. Applause. Move on.",
            skeptical_question: "How did we get here?"
          }
        }
      }
    ]
  },
  {
    role: "user",
    content: [
      { type: "tool_result", tool_use_id: "toolu_example_03", content: "Card recorded." },
      { type: "text", text: "Concept: Data Lake\nSub-tent: Analytics Arcade" }
    ]
  },
  {
    role: "assistant",
    content: [
      {
        type: "tool_use",
        id: "toolu_example_04",
        name: "generate_manufactured_exhibit_card",
        input: {
          name: "The Data Lake",
          role_tagline: "Schema-Free Storage",
          card_type: "Manufactured Exhibit",
          alignment: "Neutral Resigned",
          sub_tent: "Analytics Arcade",
          role: "Magician",
          atk: 5,
          def: 8,
          image_sign_text: null,
          effect: "Store all enterprise data in a single repository without schema enforcement. This card is considered scalable.",
          clauses: [
            { name: "INGESTION CLAUSE", rule: "If data is added to the lake: The lake is considered comprehensive." },
            { name: "SCHEMA-ON-READ EFFECT", rule: "When a query is required: A schema is invented at query time." },
            { name: "SWAMP TRANSFORMATION", rule: "After eighteen months: The lake is considered a swamp by everyone except its original sponsors." }
          ],
          witness_quote: "We're democratizing data access.",
          translation_layer: {
            observation: "Files in a folder.",
            skeptical_question: "Who knows what's in there?"
          }
        }
      }
    ]
  }
];

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not set in Netlify environment variables.' })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON in request body.' }) };
  }

  const { concept, sub_tent, role } = body;
  if (!concept || typeof concept !== 'string' || concept.trim() === '') {
    return { statusCode: 400, body: JSON.stringify({ error: 'concept is required.' }) };
  }

  // Build the user input message
  const lines = [`Concept: ${concept.trim()}`];
  if (sub_tent && sub_tent !== '') lines.push(`Sub-tent: ${sub_tent}`);
  if (role && role !== '') lines.push(`Role: ${role}`);
  const userMessage = lines.join('\n');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: [TOOL_DEFINITION],
        tool_choice: { type: 'tool', name: 'generate_manufactured_exhibit_card' },
        messages: [
          ...FEW_SHOT_MESSAGES,
          {
            role: 'user',
            content: [
              { type: 'tool_result', tool_use_id: 'toolu_example_04', content: 'Card recorded.' },
              { type: 'text', text: userMessage }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        statusCode: response.status,
        headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: `Claude API error: ${errorText}` })
      };
    }

    const data = await response.json();
    const toolUse = (data.content || []).find(c => c.type === 'tool_use');

    if (!toolUse) {
      return {
        statusCode: 502,
        headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Model did not return a tool_use block.', raw: data })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ card: toolUse.input })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: `Server error: ${err.message}` })
    };
  }
};
