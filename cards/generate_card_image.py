"""
Generate an image for a corporatecirc.us card and save it to disk.

Pipeline: load card JSON -> build image prompt with role anchor + card data
-> call gpt-image-1 -> downscale to 512x512 -> save as PNG.

Usage:
    python generate_card_image.py path/to/card.json
"""

import argparse
import base64
import io
import json
import re
from pathlib import Path

from openai import OpenAI
from PIL import Image


# === Configuration ===

# TODO: STYLE hard-codes male Victorian features (handlebar mustaches, mutton
# chops, beards) — added to fix the clean-shaven Juggler v1 regression. Some
# cards are canonically female (Booth Gorgon, Legacy User's "Karen", the
# referenced-but-unbuilt Booth Babe Basilisk) and currently render as men.
# Revisit if female-coded cards reach critical mass — would require an
# optional `performer_gender` field on cards plus a conditional female-feature
# block in build_prompt.
STYLE = (
    "vintage late-19th-century circus poster, chromolithograph style, "
    "bold flat colors, limited palette of crimson / cream / black / gold, "
    "ornate decorative borders, slight paper grain. "
    "Performers are unmistakably Victorian/gilded-age figures: "
    "period-appropriate facial hair (magnificent curly handlebar mustaches, "
    "mutton chop sideburns, or full beards), pomaded period hairstyles, "
    "intense theatrical expressions — faces that would belong in a sepia "
    "photograph from 1895. Vary the specific features by role and performer; "
    "do not produce identical faces across cards."
)

ROLE_VISUALS = {
    "Tightrope":       "circus tightrope walker in a tailored corporate suit, balancing on a high wire, balance pole in hand, focused stare",
    "Strongman":       "circus strongman in a tailored corporate suit, handlebar mustache, hoisting an oversized barbell overhead",
    "Sleight of Hand": "circus sleight-of-hand artist in a tailored corporate suit, fanning playing cards between nimble fingers, mid-trick",
    "Trapeze":         "circus trapeze artist in a tailored corporate suit, mid-swing, hands chalked",
    "Juggler":         "circus juggler in a tailored corporate suit, multiple objects in mid-air, mid-toss",
    "Ringmaster":      "circus ringmaster in a tailored corporate suit, red coat over the jacket, top hat, whip in hand",
    "Acrobat":         "circus acrobat in a tailored corporate suit, mid-leap in a dynamic flying pose, arms extended",
    "Fire Breather":   "circus fire breather in a tailored corporate suit, mid-exhale of a large plume of fire",
    "Magician":        "classic circus stage magician in a tailored corporate suit, top hat and wand, dramatic mid-conjure gesture, sparks and smoke",
    "Clown":           "circus clown in a tailored corporate suit, painted white face, red nose, oversized shoes, exaggerated grin",
    "Contortionist":   "circus contortionist in a tailored corporate suit, body twisted into an impossible pose, limbs bent unnaturally",
    "Lion Tamer":      "circus lion tamer in a tailored corporate suit, chair held forward in one hand, whip in the other, lion crouched before them",
    "Illusionist":     "circus grand illusionist in a tailored corporate suit, mid-illusion with billowing smoke and dramatic stage lighting, arms outstretched",
    "Fortune Teller":  "circus fortune teller in a tailored corporate suit, hands hovering over a glowing crystal ball, headscarf, dim mystical lighting",
    "Knife Thrower":   "circus knife thrower in a tailored corporate suit, arm cocked back mid-throw, multiple knives mid-air, spinning target wheel behind",
}

OUTPUT_DIR = Path("images")  # relative to invocation dir (cards/); canonical repo-relative path stored in JSON is "cards/images/{slug}.png"
OUTPUT_SIZE = (512, 768)
GENERATION_SIZE = "1024x1536"
QUALITY = "medium"


def slugify(name: str) -> str:
    """'The Acqui-Hire' -> 'the-acqui-hire'"""
    s = name.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def build_prompt(card: dict) -> str:
    role = card["role"]
    if role not in ROLE_VISUALS:
        raise ValueError(
            f"Unknown role: {role!r}. Must be one of {list(ROLE_VISUALS)}"
        )

    sign_text = card.get("image_sign_text")
    bottom_banner = (
        f". A second prominent banner across the lower sixth of the image, "
        f"fully within frame, reading exactly: \"{sign_text}\""
    ) if sign_text else ""

    return (
        f"subject: {ROLE_VISUALS[role]}\n"
        f"style: {STYLE}\n"
        f"satirical context: {card['name']} — {card['role_tagline']}. "
        f"{card['translation_layer']['observation']}\n"
        f"composition: portrait orientation circus poster layout. "
        f"A prominent banner across the upper sixth of the image, fully within frame, "
        f"reading exactly: \"{card['name'].upper()}\". "
        f"The performer in the central portion of the frame with their action fully visible"
        f"{bottom_banner}"
    )


def generate_image(prompt: str) -> bytes:
    client = OpenAI()  # reads OPENAI_API_KEY from the environment
    response = client.images.generate(
        model="gpt-image-1",
        prompt=prompt,
        size=GENERATION_SIZE,
        quality=QUALITY,
    )
    b64 = response.data[0].b64_json
    return base64.b64decode(b64)


def save_image(image_bytes: bytes, slug: str) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"{slug}.png"

    img = Image.open(io.BytesIO(image_bytes))
    img = img.resize(OUTPUT_SIZE, Image.LANCZOS)
    img.save(out_path, format="PNG", optimize=True)

    return out_path


def update_card_json(card_path: Path, card: dict, image_path: str) -> None:
    card["image_path"] = image_path
    with card_path.open("w", encoding="utf-8") as f:
        json.dump(card, f, indent=2, ensure_ascii=False)
        f.write("\n")


def main():
    parser = argparse.ArgumentParser(description="Generate a card image from JSON.")
    parser.add_argument("card_json", type=Path, help="Path to a card JSON file")
    args = parser.parse_args()

    with args.card_json.open("r", encoding="utf-8") as f:
        card = json.load(f)

    slug = slugify(card["name"])
    prompt = build_prompt(card)

    print(f"Generating image for '{card['name']}' (slug: {slug})...")
    print(f"\n--- prompt ---\n{prompt}\n--------------\n")

    image_bytes = generate_image(prompt)
    out_path = save_image(image_bytes, slug)

    image_path = f"cards/images/{slug}.png"
    update_card_json(args.card_json, card, image_path)

    print(f"Saved: {out_path.resolve()}")
    print(f"Updated: {args.card_json.resolve()} (image_path = {image_path})")


if __name__ == "__main__":
    main()
