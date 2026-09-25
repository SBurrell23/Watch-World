# Watch World — Brand Data Schema

Every brand is one JSON object. Research output files are JSON **arrays** of these objects.
All prices in **USD**, approximate current (2025–2026) new retail. Use `null` when truly unknown — never invent.

```jsonc
{
  "id": "patek-philippe",               // kebab-case slug, unique
  "name": "Patek Philippe",
  "tagline": "One-line hook (<= 90 chars)",
  "summary": "2–3 sentence overview of who they are and why they matter.",
  "history": "Rich history, 180–350 words, 2–4 paragraphs separated by \n\n. Founding story, key eras, crises (e.g. quartz crisis), ownership changes, today.",
  "founded": 1839,                      // year (number)
  "founders": ["Antoni Patek", "Adrien Philippe"],
  "status": "active",                   // "active" | "defunct" | "revived"
  "country": "Switzerland",
  "countryCode": "CH",                  // ISO 3166-1 alpha-2 of current HQ
  "city": "Geneva",                     // HQ city
  "continent": "Europe",                // Europe | Asia | North America | South America | Oceania | Africa
  "lat": 46.2044, "lng": 6.1432,        // HQ city coordinates (4 decimals)
  "originCountry": "Switzerland",       // where founded, if different from HQ; else same
  "parentGroup": "Independent",         // e.g. "Swatch Group", "Richemont", "LVMH", "Kering", "Seiko Group", "Citizen Group", "Casio", "Fossil Group", "Movado Group", "Independent", "Rolex SA" ...
  "ownership": "Family-owned (Stern family)",   // short string
  "segment": "Haute Horlogerie",        // one of: "Haute Horlogerie" | "Luxury" | "Premium" | "Mid-range" | "Affordable" | "Fashion" | "Independent" | "Microbrand" | "Smartwatch"
  "priceTier": 9,                        // 1–10, see scale below, based on typical core-collection price
  "priceRange": { "min": 25000, "max": 3000000 },  // entry-level model to top regular-production piece
  "popularity": 9,                       // 1–10: 10 = global household name (Rolex, Casio, Apple); 1 = known only to niche collectors
  "prestige": 10,                        // 1–10 horological prestige / respect among collectors
  "valueRetention": 10,                  // 1–10 secondary-market strength (10 = trades above retail)
  "annualProduction": "~72,000",         // string, approximate, or null
  "revenueUSD": null,                    // approx annual revenue in USD (number) or null
  "employees": null,                     // approx number or null
  "inHouseMovements": "yes",             // "yes" | "partial" | "no"
  "movementTypes": ["automatic", "manual"],   // subset of: automatic, manual, quartz, spring-drive, solar, kinetic, smart, hybrid, mechanical-digital
  "specialties": ["complications", "dress", "sport-luxury"],
      // subset of: dive, chronograph, dress, pilot, field, gmt, complications, tourbillon, sport-luxury, racing, jewelry, skeleton, avant-garde, tool, digital, smart, military, minimalist, vintage-inspired, astronomical, enamel-artistry
  "knownFor": "Short phrase, e.g. 'Grand complications & the Nautilus'",
  "innovations": ["1868: first Swiss wristwatch", "1925: first perpetual calendar wristwatch"],   // 2–6 items, "year: text"
  "timeline": [ { "year": 1839, "event": "Founded in Geneva as Patek, Czapek & Co." } ],        // 5–10 entries chronological
  "famousWearers": ["Queen Victoria", "Eric Clapton"],   // 0–6, well-documented only
  "funFacts": ["..."],                   // 2–4 surprising facts
  "website": "https://www.patek.com",
  "models": [ /* 3–6 most popular / iconic models, see below */ ]
}
```

## Model object

```jsonc
{
  "name": "Nautilus",
  "reference": "5811/1G",              // current or iconic reference, or null
  "introduced": 1976,
  "category": "sport-luxury",          // one of the specialties values
  "priceUSD": 70000,                   // approximate current retail (or last retail / typical market price if discontinued); null if unknown
  "caseMaterial": "White gold",
  "caseSizeMm": 41,
  "movement": "Cal. 26-330 S C, automatic",
  "waterResistanceM": 120,             // or null
  "description": "1–2 sentences on why it's iconic.",
  "url": "https://www.patek.com/en/collection/nautilus",   // official maker page for the model/collection (verify it exists; fall back to brand collection page)
  "imageUrl": null,                    // ONLY a direct official image URL you actually saw on the maker's site/press kit; otherwise null
  "visual": {                          // used to draw a stylised SVG render — describe the watch's actual look
    "caseShape": "cushion",            // round | cushion | tonneau | rectangular | square | octagon | oval
    "caseMetal": "white-gold",         // steel | yellow-gold | rose-gold | white-gold | platinum | titanium | black | ceramic-white | bronze | two-tone | plastic | carbon
    "dialColor": "#1f3a5f",            // hex
    "dialTexture": "textured",         // sunburst | matte | guilloche | tapisserie | linen | enamel | skeleton | meteorite | textured | digital
    "bezel": "smooth",                 // smooth | fluted | dive | gmt | tachymeter | none | octagon-screws | compass | slide-rule | digital
    "bezelColor": null,                // hex (inserts) or null for metal
    "bezelColor2": null,               // second colour for two-tone GMT bezels, else null
    "hands": "baton",                  // baton | dauphine | sword | mercedes | breguet | cathedral | leaf | snowflake | arrow | pencil | skeleton
    "handColor": "#e8e8e8",
    "indices": "baton",                // baton | arabic | roman | dots | applied-mixed | breguet-numerals | explorer | none
    "indexColor": "#e8e8e8",
    "accentColor": null,               // e.g. red seconds hand / text accent, hex or null
    "complications": ["date"],         // subset: date, day-date, chronograph, gmt, moonphase, small-seconds, power-reserve, tourbillon, perpetual-calendar, world-time, digital, open-heart, big-date, jumping-hour, retrograde
    "strap": "integrated-bracelet",    // bracelet | integrated-bracelet | leather | rubber | nato | mesh | fabric | resin
    "strapColor": "#c0c0c0",
    "crown": "normal",                 // normal | crown-guard | onion | left
    "lumeColor": null                  // hex or null
  }
}
```

## Connections graph — `data/connections.json`

```jsonc
{
  "entities": [   // non-brand nodes only (groups, movement makers, people, retailers, parent companies)
    { "id": "swatch-group", "name": "Swatch Group", "kind": "group", "country": "Switzerland", "description": "1–2 sentences." }
    // kind: group | movement-maker | person | company | retailer
  ],
  "edges": [
    {
      "source": "swatch-group", "target": "omega",
      "type": "owns",       // owns | stake | movement-supplier | designer | lineage | collaboration | founder-link | former-owner | case-dial-supplier
      "label": "Owner since 1983 (SSIH/ASUAG merger)",
      "year": 1983,         // or null
      "detail": "1 sentence of context.",
      "current": true       // false for historical relationships
    }
  ]
}
```
Brand node ids = brand `id` (kebab-case slug of the brand name: lowercase, accents stripped, `&` → `and`, non-alphanumerics → `-`, e.g. "A. Lange & Söhne" → `a-lange-and-sohne`, "Hermès" → `hermes`).
Direction: source is the owner / supplier / designer / earlier entity; target is the owned / supplied / later one.

## Price tier scale (typical core-collection new retail)
| Tier | Range |
|---|---|
| 1 | < $100 |
| 2 | $100 – 300 |
| 3 | $300 – 1,000 |
| 4 | $1,000 – 3,000 |
| 5 | $3,000 – 7,000 |
| 6 | $7,000 – 15,000 |
| 7 | $15,000 – 40,000 |
| 8 | $40,000 – 100,000 |
| 9 | $100,000 – 300,000 |
| 10 | $300,000 + |
