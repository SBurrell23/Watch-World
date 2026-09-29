# Complications Compendium — spec

## The 48 complications (canonical ids — use exactly these)

| # | id | name | category |
|---|---|---|---|
| 1 | small-seconds | Small seconds | time-display |
| 2 | deadbeat-seconds | Deadbeat (jumping) seconds | time-display |
| 3 | jumping-hour | Jumping hour | time-display |
| 4 | wandering-hour | Wandering hour | time-display |
| 5 | retrograde-display | Retrograde display | time-display |
| 6 | regulator-dial | Regulator dial | time-display |
| 7 | mechanical-digital-display | Mechanical digital display | time-display |
| 8 | power-reserve | Power reserve indicator | indication |
| 9 | day-night-indicator | Day/night (AM/PM) indicator | indication |
| 10 | depth-gauge | Depth gauge | indication |
| 11 | date | Date | calendar |
| 12 | big-date | Big (outsize) date | calendar |
| 13 | pointer-date | Pointer date | calendar |
| 14 | day-date | Day-date | calendar |
| 15 | week-number | Week number | calendar |
| 16 | complete-calendar | Complete (triple) calendar | calendar |
| 17 | annual-calendar | Annual calendar | calendar |
| 18 | perpetual-calendar | Perpetual calendar | calendar |
| 19 | chinese-calendar | Chinese traditional calendar | calendar |
| 20 | moonphase | Moon phase | astronomical |
| 21 | astronomical-moonphase | Precision (astronomical) moon phase | astronomical |
| 22 | equation-of-time | Equation of time | astronomical |
| 23 | sidereal-time | Sidereal time | astronomical |
| 24 | celestial-chart | Celestial (sky) chart | astronomical |
| 25 | sunrise-sunset | Sunrise / sunset | astronomical |
| 26 | tide-indicator | Tide indicator | astronomical |
| 27 | chronograph | Chronograph | timing |
| 28 | monopusher-chronograph | Monopusher chronograph | timing |
| 29 | flyback-chronograph | Flyback chronograph | timing |
| 30 | split-seconds-chronograph | Split-seconds (rattrapante) chronograph | timing |
| 31 | tachymeter | Tachymeter scale | timing |
| 32 | pulsometer | Pulsometer scale | timing |
| 33 | telemeter | Telemeter scale | timing |
| 34 | regatta-timer | Regatta countdown timer | timing |
| 35 | gmt | GMT (second time zone hand) | travel |
| 36 | dual-time | Dual time (two dials) | travel |
| 37 | world-time | World time | travel |
| 38 | alarm | Mechanical alarm | striking |
| 39 | quarter-repeater | Quarter repeater | striking |
| 40 | minute-repeater | Minute repeater | striking |
| 41 | grande-sonnerie | Grande sonnerie | striking |
| 42 | tourbillon | Tourbillon | regulation |
| 43 | flying-tourbillon | Flying tourbillon | regulation |
| 44 | multi-axis-tourbillon | Multi-axis tourbillon | regulation |
| 45 | carrousel | Karrusel / carrousel | regulation |
| 46 | constant-force-escapement | Constant-force mechanism / remontoir | regulation |
| 47 | fusee-and-chain | Fusée and chain | regulation |
| 48 | automaton | Automaton | artistic |

## Data — `data/complications.json` (array, one object per id above)

```jsonc
{
  "id": "minute-repeater",
  "name": "Minute repeater",
  "aka": ["Répétition minutes"],
  "category": "striking",   // time-display | indication | calendar | astronomical | timing | travel | striking | regulation | artistic
  "tagline": "One line, <= 90 chars.",
  "summary": "2–3 sentences: what it does, for a newcomer.",
  "howItWorks": "80–160 words on the mechanism in plain English.",
  "history": "60–140 words: origin, inventor, key milestones.",
  "invented": { "year": 1783, "by": "Abraham-Louis Breguet" },   // year may be approximate/null; "by" may be null
  "difficulty": 10,          // 1–10 mechanical/horological difficulty to design & build
  "difficultyLabel": "Grand complication",  // Basic | Moderate | Advanced | Expert | Grand complication
  "costTier": 5,             // 1–5 general affordability of watches featuring it: 1 = under $500 possible, 2 = ~$500–3k, 3 = ~$3k–15k, 4 = ~$15k–100k, 5 = $100k+
  "typicalEntryPriceUSD": 100000,  // roughly the cheapest mainstream new watch with it, or null
  "usefulness": 3,           // 1–10 everyday practical usefulness today
  "usefulnessType": "prestige",   // daily-practical | situational | sport-professional | travel | astronomical-curiosity | aesthetic | prestige
  "commonness": 1,           // 1–10 how common in watches on the market today: 10 = found on most watches (date), 1 = a handful of pieces a year
  "commonnessLabel": "Exceedingly rare",   // Ubiquitous (9–10) | Common (7–8) | Uncommon (5–6) | Rare (3–4) | Exceedingly rare (1–2)
  "partsCount": "~ 300 extra components",   // string or null
  "funFact": "One surprising fact.",
  "famousExamples": [ { "brand": "Patek Philippe", "brandId": "patek-philippe", "model": "Grandmaster Chime 6300" } ],  // 2–4; brandId = Watch World brand id if the brand is in data/brands.json, else null
  "pairsWith": ["perpetual-calendar"],   // ids of other complications commonly combined
  "sources": ["https://..."]              // 1–3 URLs used
}
```

## Illustrations — `js/complications/art-N.js`

Each art module: `export default { '<id>': (o) => '<svg …>…</svg>', … }` where `o = { uid }` (a unique string — prefix EVERY gradient/clipPath/mask/filter id with it).

Conventions (so all 48 look like one family):
- `viewBox="0 0 200 200"`, no width/height attributes (the page sizes them). Transparent background.
- A round (or case-appropriate) watch dial or movement vignette centred at 100,100, radius ~84, drawn in a refined, minimal, engraving-like line style — think luxury catalogue line art with a touch of gold. Not clip-art, not cartoonish.
- Colours ONLY via these CSS variables (defined in `css/complications-art.css`), applied with `style="fill:var(--cx-…)"` / `style="stroke:var(--cx-…)"` (not presentation attributes — var() doesn't work there):
  - `--cx-case` case / bezel metal · `--cx-dial` dial surface · `--cx-line` primary line work, indices, hands · `--cx-muted` secondary line work, fine scales
  - `--cx-gold` the gold accent — highlight THE complication itself with it
  - `--cx-blue` secondary accent (seconds / GMT hands) · `--cx-red` sparing accent (countdown, alarm, tide) · `--cx-night` deep night blue (moon discs, sky)
- Text: `font-family: var(--cx-font)`, small sizes, legible at 120px render.
- Animation (encouraged — make it come alive): use ONLY these classes from `css/complications-art.css`; set `style="transform-origin:Xpx Ypx"` on the element to rotate around (transform-box: view-box is applied globally):
  - `cx-spin-60s`, `cx-spin-12s`, `cx-spin-6s`, `cx-spin-2s` (continuous rotation), `cx-spin-rev-12s` (reverse), `cx-orbit-12s`
  - `cx-tick-60` (60 discrete steps per minute), `cx-jump` (a 30° snap every 3s)
  - `cx-sweep-retro` (sweep 0→120° then snap back; 6s), `cx-swing` (balance wheel ±200°, 0.4s alternate)
  - `cx-pulse` (opacity pulse — sound waves, indicators), `cx-slide` (translateY 0 → -12 → -24px steps, 6s — rolling discs)
  - Reduced motion is handled globally; do not use SMIL `<animate>`.
- Keep each SVG under ~6 KB. No external images, no fonts other than var(--cx-font).
- Each illustration must make the complication instantly recognisable: show the distinctive part in gold and, when helpful, a tiny label.
