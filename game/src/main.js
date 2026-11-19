// Entry point: boots Sunvale: Heat Rises, or stages a screenshot scene when the URL carries ?shot=<name>.
import { Game } from './core/game.js';
import { runShot } from './shots/shotScenes.js';

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const game = new Game(document.getElementById('view'), { shot });
window.__sunvale = game;

if (shot) {
  runShot(game, shot).then(() => { window.__shotReady = true; }).catch((err) => { console.error(err); window.__shotError = String(err); });
} else {
  game.start();
}
