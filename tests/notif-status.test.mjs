/**
 * Static contract guards on the notifications visibility surface. The pre-fix
 * code called Notification.requestPermission() in fire-and-forget mode and
 * the toggle never showed *why* notifications didn't actually fire on iOS or
 * after a user-denied prompt. notifSupportLevel + renderNotifStatus must
 * stay wired into the toggle so a flipped-on-but-denied state is visible.
 */
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const audioSrc   = readFileSync(join(root, 'js', 'audio.js'),   'utf8');
const timerSrc   = readFileSync(join(root, 'js', 'timer.js'),   'utf8');
const storageSrc = readFileSync(join(root, 'js', 'storage.js'), 'utf8');

test('notifSupportLevel detects iOS-needs-install', () => {
  const idx = audioSrc.indexOf('function notifSupportLevel');
  assert.ok(idx > 0, 'notifSupportLevel not found');
  const body = audioSrc.slice(idx, idx + 800);
  // Both the iOS UA test and the standalone display-mode test must be
  // present — without either, an iOS user installed to the Home Screen
  // gets the wrong message and a non-installed user thinks the app is
  // broken.
  assert.match(body, /iPad|iPhone/, 'must check iOS UA');
  assert.match(body, /standalone/, 'must check standalone display mode');
  assert.match(body, /ios-needs-install/, 'must surface ios-needs-install state');
});

test('reqNotifPerm is async and returns the post-prompt permission', () => {
  // Returning the result lets the caller update UI without a settle delay
  // — no more guessing at Notification.permission a tick later.
  const idx = audioSrc.indexOf('async function reqNotifPerm');
  assert.ok(idx > 0, 'reqNotifPerm must be async');
  const body = audioSrc.slice(idx, idx + 600);
  assert.match(body, /requestPermission/, 'must call requestPermission');
  assert.match(body, /return\s+(result|Notification\.permission)/, 'must return permission state');
});

test('toggleOpt re-renders notif status after permission flip', () => {
  // Without renderNotifStatus on the toggle path, the user flips on a
  // toggle, hits a denied permission, and sees a toggle that LOOKS active
  // but does nothing. The re-render makes the broken state visible.
  const idx = timerSrc.indexOf("if(id==='togNotif'");
  assert.ok(idx > 0, 'togNotif handler not found');
  const body = timerSrc.slice(idx, idx + 400);
  assert.match(body, /renderNotifStatus/, 'togNotif handler must call renderNotifStatus');
});

test('settings-load path renders notif status', () => {
  // First open of settings must surface the current OS-level permission
  // — not just on the user's first toggle.
  assert.match(storageSrc, /renderNotifStatus/, 'storage must call renderNotifStatus on load');
});
