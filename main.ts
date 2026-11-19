// Sunvale: Heat Rises, the gta6-01 entry (Node 22, standard library only).
// The game is game/: an original open-world crime game on a sun-soaked coast, built with three.js
// (vendored as game/vendor/*.min.js), plain static files that a desktop browser loads offline.
// Six districts, traffic and pedestrians, eight drivable car models, a five-star wanted level with
// cruisers, officers and a helicopter, four weapons, an eight-mission story, collectibles, a HUD
// with minimap, title and pause menus and localStorage saves; every sound is synthesised live.
// This program hands it in: it copies game/ and screenshots/ to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun library.
// Screenshots are real renders captured by tools/capture-shots.mjs from the scenes in shots.json.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail loudly here rather than at the gate: Sunvale ships 3 or 4 JPEG/PNG screenshots, the cover first.
const shots = existsSync(join(here, 'screenshots'))
  ? readdirSync(join(here, 'screenshots')).filter((f) => !f.startsWith('.') && /\.(jpe?g|png)$/i.test(f)).sort()
  : [];
if (shots.length < 3 || shots.length > 4) throw new Error(`screenshots/ must hold 3 or 4 images, found ${shots.length}`);

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
for (const f of shots) cpSync(join(here, 'screenshots', f), join(out, 'screenshots', f));

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
