# Moons of Ganthia — sky, orrery and ley-line viewer

Self-contained simulation of Ganthia's eight moons, the Amber Moon pass of 9179, and the moons' ley lines.
The full design record (every model decision and why) is the Claude doc "Moons of Ganthia: Engine and Design Record".

## Player and DM editions
The players do not yet know about the Amber Moon or its 9179 pass, so the build makes two editions.
Source between `@dm` markers is DM only: `/*@dm*/ … /*@end*/` in JS and CSS, `<!--@dm--> … <!--@end-->` in HTML,
and `/*@dm*/ dm text /*@end*//*@player player text*/` to swap a value (the lost fifth moon is "Fifth" for players).
Both forms leave the source valid JavaScript, so `node tools/*.js` can still load `src/core.js`.
The player edition has that code removed, not hidden; `build.py` refuses to write it if an Amber word is left.

- Players: https://moons.dragonlampart.com (`site/index.html`, deployed by Cloudflare).
- DM: `dm/index.html` on this machine, or the private Claude artifact (`dm/moons-of-ganthia.html`). `dm/` is gitignored.

## Deploying (Cloudflare)
The only site is the Cloudflare Worker `moons-of-ganthia`, at https://moons.dragonlampart.com
(also https://moons-of-ganthia.conley-ade.workers.dev). GitHub Pages is off.
Like DiceGame, Cloudflare is connected to this GitHub repo and redeploys on every push to `main`;
every other branch and pull request gets a preview address.
`wrangler.jsonc` deploys static assets from `site/` only, so `src/` (which holds the DM-only code) is never served.
Cloudflare settings: no build command, deploy command `npx wrangler deploy`; the domain is under the Worker's Domains tab.
To update the site: `python3 build.py`, commit `site/index.html`, push.

## Layout
- `site/index.html` — the player edition as a full HTML document; the deployed site. It also opens in any browser with no server.
- `wrangler.jsonc` — the Cloudflare deploy: static assets from `site/` only.
- `dm/` — the DM edition: `index.html` (full document) and `moons-of-ganthia.html` (the fragment published as the Claude artifact).
- `src/core.js` — pure orbital math (no DOM). Works in a browser or Node (`require('./src/core.js')`).
- `src/app.js` — Amber Moon orbit, ley lines, brightness, the three views, controls.
- `src/head.html`, `src/body.html` — styles and markup.
- `build.py` — rebuilds both editions: `python3 build.py`. Commit the rebuilt `site/index.html` to update the site.
- `tools/` — Node scripts used to tune and verify the model (run from this folder):
  - `node tools/check.js` — Dirole crossing distance and times, phase range and eclipse length per moon.
  - `node tools/tune2.js <perigee_km> <moon_index> <tilt_min> <tilt_max>` — coarse search for tilts whose ley line crosses Dirole (Black = 0, Red = 5).
  - `node tools/fine2.js <moon_index> <tilt> <t_guess> [range] [step]` — fine refinement of one tilt.
  - `node tools/solve.js` — solves the Amber Moon orbit (full at the 39th of Greenmoon sighting, overhead Dirole on the 40th); writes `amber_sol.json`.
  - `node tools/amber3.js` — prints the Amber Moon's distance, phase, place and magnitude through 9179, read from `src/app.js`.

After changing any orbital constant, re-run the tuning scripts: the Dirole crossings and the Amber solution depend on all of them.
