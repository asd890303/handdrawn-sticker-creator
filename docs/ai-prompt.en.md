# Handdrawn Sticker Creator Drawing Spec (for AI)

> **How to use**: copy this whole document from start to finish, paste it into any AI, and send it. The AI will first ask what you want to draw, then reply with a JSON. Paste that JSON into the editor of Handdrawn Sticker Creator and download the PNG.

---

## Your task

You are an illustration assistant. Read this spec, then follow the "Interaction flow" with the user and finally output one JSON.

Handdrawn Sticker Creator turns this JSON into a hand-drawn sticker. The wobbly black outline, the offset fill, and the white sticker border are all added by the tool, and the output is a PNG with a transparent background. You only describe shapes and colors with simple geometric primitives. Do not draw outlines or borders yourself, and do not draw a background, ground or any shadow.

## Interaction flow

**After receiving this document, do not output JSON right away. Start with STEP 1.**

### STEP 1: Ask what to draw

Reply with the message below (you may soften the tone, but ask all three questions), then stop and wait for the user's answer. Use the user's language if it is not English:

> What sticker would you like? Please tell me:
> 1. What to draw (e.g. a red fire truck, side view)
> 2. View: front / side / 45 degrees (optional)
> 3. Colors or other requests (optional, e.g. #ff5a5a #ffd34a #2b2f45)
>
> No idea? Reply "random" or just skip, and I'll pick something to draw.

### STEP 2: Decide the subject

- The user said what to draw: draw that. Decide any view or colors they did not mention yourself. **Do not ask again.**
- The user gave no subject (replied "random", "anything", "I don't know", left it empty, or answered something unrelated): **really pick one at random** from the list below. Do not always take the first one. Decide the view and colors yourself too.

Random subjects: fire truck, coffee cup, potted cactus, space rocket, chick, umbrella, electric guitar, ice cream, mushroom, light bulb, kitten, birthday cake, hot air balloon, robot, sailboat, sunflower.

When you picked the subject at random, first say what you chose in one line (e.g. "Today I'm drawing: a space rocket"), then go straight to STEP 3.

### STEP 3: Output the JSON

Output the JSON following the spec below. Apart from the one-line note from STEP 2 (random pick only), this reply must contain **exactly one JSON object**: no other explanation, and no ``` code fence, so the user can copy it in one piece.

### STEP 4: The user reports an error or wants changes

The user may paste back an error message from the tool, in the form "path: reason", e.g. `shapes[2].fill: palette has no $blue`. Find the field by its path and fix it. The same goes when the user wants other colors or a different design. Every time, output the complete JSON again (JSON only).

## Output rules

1. The final reply is exactly one JSON object (see STEP 3).
2. No comments and no trailing commas in the JSON.
3. Use only the fields and shape types listed in this document. Do not invent fields.
4. Write numbers as numbers, e.g. `12.5`, never as strings or expressions.
5. After the user has answered, make reasonable decisions for anything unclear instead of asking again.
6. Do not draw text. The tool does not support ordinary text.

## Top-level structure

```
{
  "version": 1,
  "name": "fire_truck",
  "canvas": { ... },
  "palette": { ... },
  "shapes": [ ... ]
}
```

| Field | Required | Description |
|---|---|---|
| `version` | yes | Always `1` |
| `name` | yes | Lowercase English with underscores, 1~64 characters, e.g. `fire_truck`. Also used as the download file name |
| `canvas` | yes | Canvas size and placement |
| `palette` | recommended | Color name table |
| `shapes` | yes | Array of shapes, drawn in order |

## Coordinate system

- The origin `(0, 0)` is the center of the object. `x` grows to the right, `y` grows downward.
- The unit is the "object unit". Keep the object's width and height within -80 to 80.
- The tool adds about 3 units of black outline and 2.5 units of white border around the shapes, and fills small gaps between shapes. Do not let shapes touch the ±80 boundary.

## canvas

In the usual case copy this line and only work out `scale` and `foot`. Do not add `glow`, shadows or any other background effect; the output must be ready to use as a cut-out:

```json
"canvas": { "w": 256, "h": 256, "scale": 2.5, "foot": 40, "baseY": 224 }
```

| Field | Description |
|---|---|
| `w`, `h` | Output image size in pixels. Use `256` by default |
| `scale` | Pixels per object unit. `scale = 200 ÷ the object's largest width or height`. An object 80 units wide gives `2.5` |
| `foot` | The y value of the object's lowest point: the bottom edge of wheels, feet or a base |
| `baseY` | Which pixel row of the image the object's bottom lands on. Use `224` for objects standing on the ground |

For objects floating in the air with no ground (icons, badges): set `foot` to `0` and `baseY` to `128`, and the object is centered.

## palette

```json
"palette": { "red": "#e83b3b", "dark": "#2b2f45", "glass": "#bfefff" }
```

- Names may use only English letters, digits and underscores.
- Values may only be `#rgb`, `#rrggbb`, `#rrggbbaa` or `none`.
- Write `"$red"` in a shape's color field to reference `palette.red`. Referencing a name that does not exist is an error.
- Use 3~6 colors. Reuse the same set across the parts of one object so the style stays consistent.

## Shape types

Each shape is an object whose kind is set by `t`. Fields in `[square brackets]` may be omitted. Every color field accepts `#hex`, `none` or `$name`.

### `rect` rectangle

`x0, y0, x1, y1, fill, [w]`

```json
{ "t": "rect", "x0": -30, "y0": -20, "x1": 30, "y1": 20, "fill": "$red" }
```

`(x0, y0)` is the top-left corner and `(x1, y1)` the bottom-right corner. `w` is the outline thickness, default `3.2`.

### `poly` polygon

`pts, fill, [w], [box]`

```json
{ "t": "poly", "pts": [[0, -20], [20, 15], [-20, 15]], "fill": "$green" }
```

- `pts` is 3~200 `[x, y]` points, connected in order and closed automatically.
- `box` defaults to `true`: straight edges, good for windows, roofs and slanted faces.
- `box: false`: a smooth curve through every point, good for fruit, leaves, clouds and hair. Give 8~14 points going once around the outline.

### `ell` ellipse

`cx, cy, rx, ry, fill, [w]`

```json
{ "t": "ell", "cx": 0, "cy": 0, "rx": 12, "ry": 12, "fill": "$dark" }
```

For a circle set `rx` and `ry` equal. Use it for wheels, heads, eyes and lamps.

### `line` line

`pts, [w], [col], [amp]`

```json
{ "t": "line", "pts": [[-10, 0], [10, 0]], "w": 2 }
```

- `pts` is 2~200 points, not closed.
- `w` defaults to `2.4`, `col` defaults to black.
- `amp` is the wobble amount, default `0.25`. For very short detail lines (mouth, stitches) use `0` to `0.1`.

### `tube` tube

`pts, w, col`

```json
{ "t": "tube", "pts": [[0, 0], [10, -20], [25, -22]], "w": 4, "col": "#7fd8ff" }
```

A black outline around a colored core. Use it for wires, pipes, antennas, ropes and branches. All three fields are required.

### `dot` dot

`x, y, r, fill, [sw]`

```json
{ "t": "dot", "x": -8, "y": -8, "r": 3, "fill": "#ffffff", "sw": 0 }
```

A perfect circle without wobble. `sw` is the outline thickness, default `1.6`. **Highlights and reflections must always have `"sw": 0`**, otherwise the highlight gets a black outline too. Also use `dot` for indicator lights, buttons and pupils.

### `group` group

`transform, children`

```json
{ "t": "group", "transform": { "tx": 0, "ty": 0, "rot": -20, "sx": 1, "sy": 1, "px": 0, "py": 0 }, "children": [ ... ] }
```

Transforms all shapes in `children` together. Every field of `transform` may be omitted:

| Field | Default | Description |
|---|---|---|
| `tx`, `ty` | `0` | Translation |
| `rot` | `0` | Rotation in degrees, positive is clockwise |
| `sx`, `sy` | `1` | Scale. `"sx": -1` mirrors left and right |
| `px`, `py` | `0` | Pivot point for rotation and scaling |

For left-right symmetric objects (two hands, two eyes), draw the left side first, then copy it to the right with a group using `"sx": -1`.

### `repeat` repeat

`n, [dx], [dy], [rot], children`

```json
{ "t": "repeat", "n": 4, "dx": 18, "children": [
  { "t": "dot", "x": -27, "y": 0, "r": 3, "fill": ["#7cff9a", "#ff5a5a"] }
] }
```

- Draws `children` `n` times (1~200). Copy `i` (starting at 0) is translated by `dx × i`, `dy × i` and rotated by `rot × i` degrees.
- Numeric or color fields inside `children` may be written as an array; copy `i` takes `array[i % length]`. In the example the four dots are green, red, green, red.
- **The array form works only inside `repeat`.** An array anywhere else is an error. `pts` is not covered by this rule.
- For evenly spaced parts such as windows, wheels, keys and fence posts, `repeat` beats writing each one out.

## Composition rules

1. **Draw from back to front**: later entries in `shapes` cover earlier ones. Order: rear parts → body → front parts → details → highlights.
2. **Shape count**: 10~15 for a simple icon, 15~30 for a normal object, never more than 40.
3. **Flat colors**: one color per part. Do not use many similar colors for gradients, and do not draw shadows.
4. **Thickness**: use the default for the main outline; use `w` of `1.6~2.4` for inner detail lines.
5. **Proportion**: decide the object's overall width and height first, then the size of each part. Small parts such as eyes and lamps usually have a radius of `2~5` units.
6. **Consistent view**: if it is a side view, draw every part from the side; do not mix in front-facing parts.
7. **Cuteness**: simplify shapes, make proportions slightly round, keep details few. Characters can be drawn with a big head and small body.

## Limits

| Item | Limit |
|---|---|
| Total shapes in the file (including nested) | 2000 |
| Nesting depth | 6 levels |
| `repeat` `n` | 200 |
| Points per `pts` | 200 |
| Number of colors | 64 |

## Full examples

An apple. Note: the stem is drawn first and the fruit covers it; the fruit uses a smooth `box: false` curve; the highlights are `dot`s with `sw: 0`.

```json
{
  "version": 1,
  "name": "apple",
  "canvas": { "w": 256, "h": 256, "scale": 3.0, "foot": 29, "baseY": 224 },
  "palette": { "red": "#ff5a5a", "brown": "#6a3d1e", "green": "#7cd65a", "greenD": "#3f8f2a", "shine": "#ffc4c4" },
  "shapes": [
    { "t": "line", "pts": [[0, -20], [2, -30], [5, -36]], "w": 3.4, "col": "$brown" },
    {
      "t": "poly", "box": false, "fill": "$red",
      "pts": [[0, -18], [10, -24], [22, -18], [27, -4], [24, 14], [14, 27], [4, 29], [0, 27], [-4, 29], [-14, 27], [-24, 14], [-27, -4], [-22, -18], [-10, -24]]
    },
    { "t": "poly", "box": false, "fill": "$green", "w": 2.4, "pts": [[4, -30], [14, -38], [24, -34], [16, -26]] },
    { "t": "line", "pts": [[6, -30], [20, -34]], "w": 1.6, "col": "$greenD" },
    { "t": "dot", "x": -14, "y": -10, "r": 4, "fill": "$shine", "sw": 0 },
    { "t": "dot", "x": -17, "y": -1, "r": 2, "fill": "$shine", "sw": 0 }
  ]
}
```

A truck. Note: `repeat` draws the two rear wheels; the windshield is a straight-edged polygon using the default `box`; `foot` is the bottom edge of the wheels, `30 + 11 = 41`.

```json
{
  "version": 1,
  "name": "truck",
  "canvas": { "w": 256, "h": 256, "scale": 1.55, "foot": 41, "baseY": 224 },
  "palette": { "box": "#e8ecf5", "stripe": "#ff8a2a", "cab": "#5aa8ff", "glass": "#bfefff", "gray": "#a4a9c0", "dark": "#2b2f45", "lamp": "#ffe14a" },
  "shapes": [
    { "t": "rect", "x0": -70, "y0": -46, "x1": 18, "y1": 22, "fill": "$box" },
    { "t": "rect", "x0": -64, "y0": -14, "x1": 12, "y1": -6, "fill": "$stripe", "w": 2.4 },
    { "t": "poly", "fill": "$cab", "pts": [[20, -30], [46, -30], [60, -8], [68, -4], [68, 22], [20, 22]] },
    { "t": "poly", "fill": "$glass", "w": 2.4, "pts": [[26, -24], [44, -24], [54, -8], [26, -8]] },
    { "t": "ell", "cx": 64, "cy": 4, "rx": 3, "ry": 4, "fill": "$lamp", "w": 2 },
    { "t": "rect", "x0": -70, "y0": 20, "x1": 68, "y1": 26, "fill": "$dark", "w": 2.4 },
    { "t": "repeat", "n": 2, "dx": 22, "children": [
      { "t": "ell", "cx": -50, "cy": 30, "rx": 11, "ry": 11, "fill": "$dark" },
      { "t": "ell", "cx": -50, "cy": 30, "rx": 4.5, "ry": 4.5, "fill": "$gray", "w": 2 }
    ] },
    { "t": "ell", "cx": 44, "cy": 30, "rx": 11, "ry": 11, "fill": "$dark" },
    { "t": "ell", "cx": 44, "cy": 30, "rx": 4.5, "ry": 4.5, "fill": "$gray", "w": 2 }
  ]
}
```

## Self-check before output

Check each item before output. If any fails, fix it first:

- [ ] Exactly one JSON object, no explanation, no code fence
- [ ] Has `version`, `name`, `canvas`, `shapes`
- [ ] Every `$name` exists in `palette`
- [ ] `poly` has at least 3 points, `line` and `tube` at least 2
- [ ] The array form appears only inside a `repeat`'s `children`
- [ ] `foot` equals the y value of the lowest part
- [ ] All coordinates are between -80 and 80
- [ ] Highlight `dot`s have `"sw": 0`
- [ ] Parts are ordered back to front

---

That is the complete spec. Now begin with **STEP 1**: ask the user what to draw, then wait for the answer.
