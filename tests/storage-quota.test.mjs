/**
 * Proactive storage-quota probe guards. Before this fix the only signal of
 * approaching localStorage exhaustion was the reactive QuotaExceededError
 * banner — by which point writes had already started failing. The new
 * probe samples navigator.storage.estimate() periodically and warns at
 * ≥80% with a 5pct hysteresis to avoid flapping.
 */
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const storageSrc = readFileSync(join(root, 'js', 'storage.js'), 'utf8');

test('saveState fires the quota probe via microtask', () => {
  // The probe runs in the same microtask as _queueEmbedEnsure so it
  // doesn't block the LS write itself. If a future refactor moves the
  // microtask, the probe must move with it.
  const probeIdx = storageSrc.indexOf('_maybeCheckStorageQuota');
  assert.ok(probeIdx > 0, '_maybeCheckStorageQuota call missing');
  // saveState's microtask block contains both the embed-ensure and the
  // quota probe — they share the queueMicrotask scope.
  const microIdx = storageSrc.indexOf('queueMicrotask(() =>');
  assert.ok(microIdx > 0 && probeIdx > microIdx, 'probe must run inside the saveState microtask');
});

test('quota probe uses navigator.storage.estimate', () => {
  const idx = storageSrc.indexOf('function _maybeCheckStorageQuota');
  assert.ok(idx > 0, '_maybeCheckStorageQuota not found');
  const body = storageSrc.slice(idx, idx + 1200);
  assert.match(body, /navigator\.storage\.estimate/, 'must use the standard storage estimate API');
});

test('quota probe rate-limits to avoid spam', () => {
  // Without a counter and a time-based gate, every save triggers an async
  // estimate() call — wasteful and on some browsers measurable.
  const idx = storageSrc.indexOf('function _maybeCheckStorageQuota');
  const body = storageSrc.slice(idx, idx + 1200);
  assert.match(body, /_quotaProbeCounter/, 'must use a save-counter throttle');
  assert.match(body, /_lastQuotaProbeAt/, 'must use a wall-clock throttle');
  assert.match(body, /60_?000/, 'must enforce ~60s minimum spacing');
});

test('quota banner uses 80% threshold + 5pct hysteresis', () => {
  // Threshold-only without hysteresis means a banner-flapping loop right
  // around 80%. The 5pct gap means a dismissed banner stays gone until
  // usage genuinely worsens.
  const idx = storageSrc.indexOf('function _maybeCheckStorageQuota');
  const body = storageSrc.slice(idx, idx + 1200);
  assert.match(body, /pct\s*<\s*80/, 'must use 80% threshold');
  assert.match(body, /_proactiveQuotaShownPct\s*\+\s*5/, 'must enforce 5pct hysteresis');
});
