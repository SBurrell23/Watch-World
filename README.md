# Watch World

An illustrated atlas of horology: an interactive guide to 200+ watch brands, from the Holy Trinity to Casio.

**Live site:** https://sburrell23.github.io/Watch-World/

## Features
- **Explore**: faceted search across 209 brands (continent, segment, price tier, founding year, group, movement, specialties…) with shareable URLs
- **Brand pages**: history, timeline, innovations, famous wearers, stat meters, and iconic models with links to the maker's site
- **Illustrated models**: every one of the 800+ models is drawn as a procedural SVG from its real design (case, dial, bezel, hands, complications), with official photos where available
- **World Map**: brands by headquarters, with zoom presets for the Jura Arc, Geneva and Japan
- **Price Ladder**: a log-scale guide from $20 to $5M with a "what does your budget buy" slider
- **Timeline of Horology**: three centuries of founding dates across the eras, including the Quartz Crisis
- **Groups & Ownership**: who owns whom (Swatch Group, Richemont, LVMH…)
- **Brand Network**: a force-directed graph of ownership, stakes, movement suppliers, designers and lineage
- **Model Gallery**, **Watch Finder** quiz, **Compare** (radar charts), **Favorites**, and a **Learn** section with a glossary
- Dark/light themes, ⌘K search, responsive down to 360px

## Development
No build step for the front end. Serve the folder statically:

```bash
npx http-server . -p 8130
```

Research data lives in `data/raw/` (schema: `data/SCHEMA.md`). Regenerate `data/brands.json` and `data/connections.json` with:

```bash
node tools/build-data.mjs
```

GitHub Actions rebuilds the data and deploys to Pages on every push to `main`.

## Disclaimer
Prices are approximate retail figures in USD, and data was researched in 2026 and may contain errors. This site is not affiliated with any watch brand. Trademarks belong to their owners.
