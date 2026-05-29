// netlify/lib/card-voice-rules.js
//
// Shared satirical voice rules and base schema for card generators across decks
// (Flea Circus, War Room, Indifferencer, future decks). Each deck's generator
// owns its own framing, sub-tent/suit enum, role enum, anti-patterns, few-shot
// examples, and card_type. This module owns the parts that stay constant
// across decks: the voice register beneath the surface (forensic Translation
// Layer, anonymous witness, inversion principle), the structural shape of a
// card (name format, clause pattern, TL fields), the alignment grid, the
// stats guidance, and the base schema fields.
//
// Each generator imports what it needs and composes its own SYSTEM_PROMPT and
// TOOL_DEFINITION. No build-a-prompt helpers — generators stay readable as
// flat templates and can drift independently of each other.

// Voice rules shared across decks. The deck-specific outward voice (vendor
// pitch deck for Flea Circus, leadership-page register for War Room face
// cards, etc.) is owned by each generator and prepended to this block.
const VOICE_RULES_SHARED = `- The Translation Layer's voice is forensic: brutally clinical, naming what's actually happening under the marketing apparatus.
- Witness quotes are testimony: anonymous, short (2-7 words), the kind of phrase actually said in a meeting.
- Honor the inversion: the more elaborate the corporate language, the more mundane its Translation Layer.
- Do not name specific real vendors or products. Satirize the category, not the company.
- Do not break voice for explanation. The card is the artifact.`;

// Structural rules for the card body. Deck-specific structural rules (e.g.,
// image_sign_text for circus posters) are appended by each generator.
const STRUCTURAL_RULES_SHARED = `- name: "The [Noun]" form. Title case.
- role_tagline: 1-3 words of corpspeak compression.
- effect: Pattern: "[Action]. This card is considered [adjective]."
- clauses: 2-3 named conditional rules. Names ALL CAPS, suffixed with CLAUSE / EFFECT / OVERRIDE / PROTECTION. Each rule: "[Trigger]: [Consequence]."
- witness_quote: 2-7 words. Anonymous. Punchy.
- translation_layer.observation: 2-5 words. Deadpan factual description.
- translation_layer.skeptical_question: A short, quiet question raised by the magnifying glass.`;

const STATS_GUIDANCE = `Every card carries an ATK score (1-10) and a DEF score (1-10). Assign them based on the card's satirical weight — its presence in a meeting, its capacity to derail or absorb pressure, its threat or shield value in the game's loose corporate metaphor. Provide no methodology. Do not justify the numbers. The arbitrariness is part of the satire — corporate scoring systems assign confident integers from vibes, and so does this one. Assign different numbers to different cards. Cards that satirize attack-shaped phenomena (declarations, escalations, demos) tend toward higher ATK; cards that satirize defensive phenomena (documents, stalemates, deflections) tend toward higher DEF. But you may also subvert these tendencies. The numbers should feel definite and unbalanced.`;

// Includes the intro line so generators can interpolate this directly under
// an "ALIGNMENT" header without restating the lead-in.
const ALIGNMENT_GRID = `Every card carries a corporate alignment from this 3×3 grid:

- Lawful Compliant — by-the-book, faithfully procedural (a properly-filed risk register)
- Lawful Performative — compliance theater for the procedural audience (an audit signed before being read)
- Lawful Resigned — rote execution without belief (the quarterly report no one opens)
- Neutral Acquisitive — self-serving advancement without ideology (the operator who works the system for personal credit)
- Neutral Pragmatic — outcome-focused, ceremony-free (the senior IC who quietly fixes things)
- Neutral Resigned — going through the motions (the recurring meeting that survived its purpose)
- Chaotic Innovative — genuine disruption with novel shape (rare in the deck — the satire is mostly the absence of this)
- Chaotic Captured — disruption absorbed into procedure (the hackathon that became a quarterly KPI; the agile transformation that produced its own steering committee)
- Chaotic Performative — disruption theater, spectacle of innovation (the AI-first mandate)
- Chaotic Volatile — uncontrolled and hazardous (the executive declaration that breaks three teams)`;

const ALIGNMENT_ENUM = [
  "Lawful Compliant", "Lawful Performative", "Lawful Resigned",
  "Neutral Acquisitive",  "Neutral Pragmatic",   "Neutral Resigned",
  "Chaotic Innovative", "Chaotic Captured", "Chaotic Performative", "Chaotic Volatile"
];

const HEAVY_LIFTING_NOTE = `Aim for at least one clause per card that does the satirical heavy lifting (e.g., "Forgetfulness Clause: Next turn: No one remembers how it worked").`;

// Base schema fields shared across decks. Each generator pulls these into its
// own input_schema.properties and adds deck-specific fields (card_type,
// sub_tent/suit, role, image_sign_text, etc.) at the appropriate positions.
// Field order at the use site is the generator's choice — splat or pluck.
const BASE_SCHEMA_FIELDS = {
  name: { type: "string", description: "Card title in 'The [Noun]' form." },
  role_tagline: { type: "string", description: "1-3 words of corpspeak compression." },
  alignment: {
    type: "string",
    enum: ALIGNMENT_ENUM,
    description: "Corporate alignment from the 3×3 grid. Resist defaulting to Performative."
  },
  atk: {
    type: "integer",
    minimum: 1,
    maximum: 10,
    description: "Attack score 1-10. Assign based on satirical weight. Do not justify."
  },
  def: {
    type: "integer",
    minimum: 1,
    maximum: 10,
    description: "Defense score 1-10. Assign based on satirical weight. Do not justify."
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
};

module.exports = {
  VOICE_RULES_SHARED,
  STRUCTURAL_RULES_SHARED,
  STATS_GUIDANCE,
  ALIGNMENT_GRID,
  ALIGNMENT_ENUM,
  HEAVY_LIFTING_NOTE,
  BASE_SCHEMA_FIELDS
};
