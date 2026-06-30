# The Adventurer's Almanac

A live **Old School RuneScape** planning ledger. It started life as a deep Excel
workbook (the `OSRS_Trackers` workbook) whose every figure was driven by two
static inputs — a Hiscores paste and a Grand Exchange price snapshot. This app
keeps all of that depth but swaps those two inputs for **live data**, wraps it in
an intuitive parchment-themed web UI, and saves everything you enter in your
browser.

Built with **React + Vite**. No build-time secrets required.

## What it does

Twelve interlinked sections, mirroring (and extending) the workbook:

| Section | What it gives you |
|---|---|
| **Dashboard** | One-glance cockpit: net worth, best money/hr right now, primary-goal bars, what to grab next |
| **Skills** | All 23 skills with XP-to-next / XP-to-99, pulled live from your hiscores |
| **Goals** | Per-skill time-to-goal (EHP) with editable XP/hr & GP/hr, funding timeline |
| **Net Worth** | Weekly snapshots, wealth curve, change tracking |
| **GE Flipping** | Live "worth-it" flip scanner (margin/tax/volume/affordability gates), a flip ledger, and per-item performance |
| **High Alchemy** | Profit/cast from live alch value − GE buy − nature rune; best sustainable pick |
| **Bossing** | Boss database with live-priced drop tables, accessibility gated by your combat/Slayer, **per-boss editable kills/hr & GP/hr**, KC tracker, drop-rate luck |
| **Slayer** | Weighted-XP block calculator, EV/hr per task, monster DB, point-unlock priorities |
| **Gear Path** | Per-style gear progression with live GE prices; Main vs Ironman obtain paths |
| **Farming** | Daily run circuit, time-to-target XP engine, herb-run P&L |
| **Quests** | All ~156 quests with skill/QP gating → Done / Stat-ready / Blocked, four orderings; click to mark done |
| **Diary & CA** | 48 diary tiers ranked by your stats, plus Combat Achievement tiers |

## Live data sources

* **Stats** — enter a RuneScape name and hit *Fetch stats*. Pulled live from the
  official **OSRS Hiscores** via the `/api/hiscores` serverless proxy
  (`api/hiscores.js`), which also detects your account type for the Main/Ironman
  default by checking the official Ironman hiscores board.
* **Prices** — the **OSRS Wiki real-time prices API** (`latest` / `mapping` /
  `volumes`) powers the flip scanner, alch picks, gear prices and boss drop
  values. Hit any **⟳ Live prices** button to refresh.
* **MediaWiki API** — used only to fill gaps the built-in data doesn't cover.

**Quest points** aren't exposed by the public APIs for mains, so QP is derived
from the quests you mark done on the Quests tab (and topped up by the hiscores
value if it's ever present).

Everything degrades gracefully — if a fetch is blocked or offline, the app keeps
working on its last values and manual entry.

## Run / deploy

```
npm install
npm run dev        # local dev at http://localhost:5173
npm run build      # production build → dist/
```

Deploy to **Vercel** (auto-detects Vite). The `api/hiscores.js` serverless
function provides the hiscores proxy in production.

## Project layout

```
index.html              app shell, fonts, PWA tags
src/main.jsx            mounts <Almanac/>
src/Almanac.jsx         the whole app (state, math, all 12 sections)
src/lib/api.js          live data layer (hiscores, Wiki prices, MediaWiki)
src/lib/ui.jsx          parchment theme + shared components
src/data/               baked-in database (quests, bosses, diaries, gear, orderings)
api/hiscores.js         serverless proxy for the official OSRS hiscores
```
