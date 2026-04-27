// generate-card.js
// Netlify Function: generates a Manufactured Exhibit card for The Product Flea Circus.
//
// Reads { concept, sub_tent?, osi_layer? } from the POST body, calls Claude with the
// V1 system prompt + few-shot examples, and returns a schema-compliant JSON card.
//
// Requires the env var ANTHROPIC_API_KEY (set in Netlify UI, NOT in code).

const SYSTEM_PROMPT = `You generate Manufactured Exhibit cards for The Product Flea Circus, a satirical card game by Indifferencer, Inc. Your output must be a single card matching the provided tool schema.

THE GAME
The Product Flea Circus satirizes enterprise marketing technology and the rhetorical apparatus around it. Real but operationally modest technical capabilities are narrated into significance by elaborate marketing language. The audience experiences the marketing, not the technology. Functional output remains constant across all stages.

Cards are organized by the OSI model layer where the satirical phenomenon operates. Manufactured Exhibits typically live at Layer 7 (Application — visible product features) but may sit lower.

VOICE RULES
- The card's outward voice is vendor pitch deck: confident, declarative, narrating modest capabilities into transformative ones.
- The Translation Layer's voice is forensic: brutally clinical, naming what's actually happening under the marketing apparatus.
- Witness quotes are testimony: anonymous, short (2-7 words), the kind of phrase actually said in a meeting.
- Honor the inversion: the more elaborate the corporate language, the more mundane its Translation Layer.
- Do not name specific real vendors or products. Satirize the category, not the company.
- Do not break voice for explanation. The card is the artifact.

STRUCTURAL RULES
- name: "The [Noun]" form. Title case.
- role_tagline: 1-3 words of corpspeak compression.
- effect: Pattern: "[Action]. This card is considered [adjective]."
- clauses: 2-3 named conditional rules. Names ALL CAPS, suffixed with CLAUSE / EFFECT / OVERRIDE / PROTECTION. Each rule: "[Trigger]: [Consequence]."
- witness_quote: 2-7 words. Anonymous. Punchy.
- translation_layer.observation: 2-5 words. Deadpan factual description.
- translation_layer.skeptical_question: A short, quiet question raised by the magnifying glass.
- image_sign_text (optional): A marketing slogan visible in the artwork. Punchy capitals.

SUB-TENTS
- CDP Circus — customer data platforms, identity resolution
- AI Pavilion — AI/ML features and rhetorical infrastructure
- Analytics Arcade — KPIs, dashboards, reporting
- Compliance Sideshow — GDPR, governance, legal infrastructure
- COE Circus — institutional capability theater
- other — name the new tent in carnival vocabulary via sub_tent_detail

ANTI-PATTERNS
- Do not exceed 3 clauses.
- Do not pad Translation Layer with corporate language.
- Do not generate Performer or Counter Spell cards. V1 is Manufactured Exhibits only.

Aim for at least one clause per card that does the satirical heavy lifting (e.g., "Forgetfulness Clause: Next turn: No one remembers how it worked").`;

const TOOL_DEFINITION = {
  name: "generate_manufactured_exhibit_card",
  description: "Return a single Manufactured Exhibit card matching the schema.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Card title in 'The [Noun]' form." },
      role_tagline: { type: "string", description: "1-3 words of corpspeak compression." },
      card_type: { type: "string", enum: ["Manufactured Exhibit"] },
      osi_layer: { type: "integer", enum: [1, 2, 3, 4, 5, 6, 7] },
      sub_tent: {
        type: "string",
        enum: ["CDP Circus", "AI Pavilion", "Analytics Arcade", "Compliance Sideshow", "COE Circus", "other"]
      },
      sub_tent_detail: {
        type: ["string", "null"],
        description: "Required when sub_tent is 'other'. Names the new tent."
      },
      image_sign_text: {
        type: ["string", "null"],
        description: "Optional marketing slogan visible in artwork. Punchy capitals."
      },
      effect: {
        type: "string",
        description: "Primary effect. Pattern: '[Action]. This card is considered [adjective].'"
      },
      clauses: {
        type: "array",
        minItems: 2,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "ALL CAPS. CLAUSE / EFFECT / OVERRIDE / PROTECTION suffix." },
            rule: { type: "string", description: "'[Trigger]: [Consequence].'" }
          },
          required: ["name", "rule"]
        }
      },
      witness_quote: { type: "string", description: "2-7 words. Anonymous. Punchy." },
      translation_layer: {
        type: "object",
        properties: {
          observation: { type: "string", description: "Deadpan factual description. 2-5 words." },
          skeptical_question: { type: "string", description: "Magnifying-glass follow-up question." }
        },
        required: ["observation", "skeptical_question"]
      }
    },
    required: ["name", "role_tagline", "card_type", "osi_layer", "sub_tent", "effect", "clauses", "witness_quote", "translation_layer"]
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
    content: "Concept: A circus strongman demonstrating exceptional strength.\nSub-tent: COE Circus\nOSI Layer: 7"
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
          osi_layer: 7,
          sub_tent: "COE Circus",
          sub_tent_detail: null,
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
      { type: "text", text: "Concept: A tightrope walker maintaining balance under uncertain conditions.\nSub-tent: COE Circus\nOSI Layer: 7" }
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
          osi_layer: 7,
          sub_tent: "COE Circus",
          sub_tent_detail: null,
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
      { type: "text", text: "Concept: The impressive outcome at the end of a project, where everything is justified after the fact.\nSub-tent: COE Circus\nOSI Layer: 7" }
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
          osi_layer: 7,
          sub_tent: "COE Circus",
          sub_tent_detail: null,
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
      { type: "text", text: "Concept: Data Lake\nSub-tent: Analytics Arcade\nOSI Layer: 7" }
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
          osi_layer: 7,
          sub_tent: "Analytics Arcade",
          sub_tent_detail: null,
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

  const { concept, sub_tent, osi_layer } = body;
  if (!concept || typeof concept !== 'string' || concept.trim() === '') {
    return { statusCode: 400, body: JSON.stringify({ error: 'concept is required.' }) };
  }

  // Build the user input message
  const lines = [`Concept: ${concept.trim()}`];
  if (sub_tent && sub_tent !== '') lines.push(`Sub-tent: ${sub_tent}`);
  if (osi_layer && osi_layer !== '') lines.push(`OSI Layer: ${osi_layer}`);
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
