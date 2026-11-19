// Entry point: boots the game, runs the title screen, pause menu and the frame loop.

import { Game } from './game/game.js';
import { Menus } from './ui/menus.js';
import { hasSave, readSave, applySave } from './game/saveGame.js';
import { runShotScene } from './game/shotScenes.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);
window.sunvale = game;

const params = new URLSearchParams(location.search);
const shot = params.get('shot');

const menus = new Menus({
  newGame() {
    game.audio.start();
    menus.hideTitle();
    game.hud.show(true);
    game.mode = 'play';
    game.camera.mode = 'play';
    game.camera.snapBehind(game.player.heading);
    game.input.requestLock();
    game.greet();
  },
  continueGame() {
    applySave(game, readSave());
    this.newGame();
    game.hud.notify('Save loaded.');
  },
  resume() {
    menus.closePause();
    game.mode = 'play';
    game.input.enabled = true;
    game.input.requestLock();
  },
  save() {
    game.hud.notify(game.save() ? 'Game saved.' : 'Could not save in this browser.');
    document.getElementById('save-note').textContent = 'Saved at ' + document.getElementById('hud-clock').textContent;
  },
  quit() {
    game.save();
    location.reload();
  },
});

function openPause() {
  if (game.mode !== 'play') return;
  game.mode = 'paused';
  game.input.releaseLock();
  menus.openPause(game);
}

addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP' || e.code === 'KeyM') {
    if (game.mode === 'play') { openPause(); if (e.code === 'KeyM') menus.showTab('map'); }
    else if (game.mode === 'paused' && e.code !== 'KeyM') menus.h.resume();
  }
});
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && game.mode === 'play' && game.input.wasLocked) openPause();
  if (document.pointerLockElement) game.input.wasLocked = true;
});

// title screen: a slow flyover of the city behind the menu
function titleCamera(t) {
  const a = t * 0.03;
  game.camera.setCinematic(Math.cos(a) * 260 - 40, 70 + Math.sin(t * 0.1) * 10, Math.sin(a) * 260 + 60, -20, 20, 40, 55);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game.mode === 'title') { game.time += dt; titleCamera(game.time); game.traffic.update(dt); game.peds.update(dt); game.landmarks.update(dt); game.fx.update(dt); game.stage.follow(game.player.pos.x, game.player.pos.z); }
  else if (game.mode !== 'paused') game.update(dt);
  game.render();
  game.input.endFrame();
  requestAnimationFrame(frame);
}

if (shot) {
  runShotScene(game, menus, shot, Number(params.get('seed') ?? 1));
} else {
  menus.showTitle(hasSave());
  requestAnimationFrame(frame);
}
