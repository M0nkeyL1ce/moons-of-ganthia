# Moons of Ganthia — sky, orrery and ley-line viewer

Self-contained simulation of Ganthia's eight moons, the Amber Moon pass of 9179, and the moons' ley lines.
The full design record (every model decision and why) is the Claude doc "Moons of Ganthia: Engine and Design Record".

## Layout
- `index.html` — the built page as a full HTML document; open it in any browser (needs no server) or put it on any static web host.
- `moons-of-ganthia.html` — the same page as a fragment, the form published as the Claude artifact.
- `src/core.js` — pure orbital math (no DOM). Works in a browser or Node (`require('./src/core.js')`).
- `src/app.js` — Amber Moon orbit, ley lines, brightness, the three views, controls.
- `src/head.html`, `src/body.html` — styles and markup.
- `build.py` — rebuilds both pages: `python3 build.py`.
- `tools/` — Node scripts used to tune and verify the model (run from this folder):
  - `node tools/check.js` — Dirole crossing distance and times, phase range and eclipse length per moon.
  - `node tools/tune2.js <perigee_km> <moon_index> <tilt_min> <tilt_max>` — coarse search for tilts whose ley line crosses Dirole (Black = 0, Red = 5).
  - `node tools/fine2.js <moon_index> <tilt> <t_guess> [range] [step]` — fine refinement of one tilt.
  - `node tools/solve.js` — solves the Amber Moon orbit (full at the 39th of Greenmoon sighting, overhead Dirole on the 40th); writes `amber_sol.json`.
  - `node tools/amber3.js` — prints the Amber Moon's distance, phase, place and magnitude through 9179, read from `src/app.js`.

After changing any orbital constant, re-run the tuning scripts: the Dirole crossings and the Amber solution depend on all of them.
