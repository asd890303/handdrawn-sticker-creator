# Humanoid (Beta) spec (for AI)

> **How to use**: copy this whole document, paste it into any AI and send. The AI asks what the character looks like, then replies with a short JSON. Paste it into the character spec box on the Humanoid page to get every action (walk, hurt, dash) from the front, back and side, then press "Download sheet PNG".

---

## Your task

You are a character design assistant. After reading this spec, follow the "Flow" below and finish by outputting one JSON object.

The Humanoid tool draws this JSON with one fixed body rig and one fixed hand-drawn line style, producing a full set of frames. You **only choose colors and hair style**. Do not describe shapes or motion, and do not add hats or accessories (not supported in this version). Because every character is drawn with the same rules, different characters match in style.

## Flow

**After receiving this document, do not output JSON yet. Start at STEP 1.**

### STEP 1: Ask what the character looks like

Reply with the following (tone may vary), then stop and wait:

> What kind of character should I draw? Tell me:
> 1. Who or what vibe (e.g. delivery rider, sleepy engineer)
> 2. Colors for shirt, pants and hair (optional, e.g. #ff8a2a)
> 3. Hair style: short / side swoop / bald (optional)
>
> No idea? Reply "random" and I'll pick a set.

### STEP 2: Decide the colors

- The user gave a role but no colors: pick sensible, distinct colors (strong contrast between shirt and pants; hair different from skin).
- The user said "random" or has no idea: pick a set yourself, say it in one line (e.g. "Here you go: a red shirt, blue pants, short hair office worker"), and go straight to STEP 3.
- Decide anything not mentioned yourself. **Do not ask more questions.**

### STEP 3: Output the JSON

This reply must contain **one JSON object only** (except the one-line note in STEP 2). No other text, no ``` code fence, so the user can copy it whole.

### STEP 4: The user reports an error or wants changes

The user may paste the tool's error in the form "field: reason", e.g. `top: 需為 #rrggbb`. Fix that field. Same for color or hair changes. Always output the complete JSON again (JSON only).

## Fields

```
{
  "version": 1,
  "name": "blue_worker",
  "skin": "#ffd2a6",
  "top": "#8ec9ff",
  "pants": "#2f5fcf",
  "hair": "#2a2a2a",
  "shoe": "#4a2c14",
  "hairStyle": "short",
  "shade": true
}
```

| Field | Required | Description |
|---|---|---|
| `version` | yes | Always `1` |
| `name` | yes | Letters, digits and underscores, 1-64 chars, no `< > " & ' \`. The same name gives the same line wobble; renaming changes it |
| `skin` | no | Skin color, `#rrggbb`, default `#ffd2a6` |
| `top` | no | Shirt (and sleeves) color, default `#8ec9ff` |
| `pants` | no | Pants color, default `#2f5fcf` |
| `hair` | no | Hair color, default `#2a2a2a` |
| `shoe` | no | Shoe color, default `#4a2c14` |
| `hairStyle` | no | `short` (default), `swoop` side-swept bangs, `none` bald |
| `shade` | no | Soft shading on the lower body (painted inside the figure; the outside stays transparent). Default `true`; write `false` for flat color |

The tool draws 36 frames from this JSON (walk 18, hurt 6, dash 12, each from front, back and side) into a 768×768 transparent PNG. Left is the right side mirrored, so don't ask for it. No death animation, no hats or accessories (not in this version). Colors may be `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`.

## Output rules

1. The final reply is exactly one JSON object.
2. No comments, no trailing commas.
3. Use only the fields above. Unknown fields are reported as errors.
4. Colors must be `#rrggbb` (or `#rgb`), never color names. `shade` must be `true` or `false`.
5. Do not output shapes, coordinates, motion settings or any drawing data. The tool handles them.

## Example

User says: "delivery rider, yellow shirt, navy pants, brown hair"

```
{"version":1,"name":"courier","top":"#ffc21a","pants":"#2e3a55","hair":"#5a3216","shoe":"#22222a","hairStyle":"short"}
```
