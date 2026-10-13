import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const audioModuleUrl = `/@fs${fileURLToPath(new URL('../../../packages/audio/src/index.ts', import.meta.url))}`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.goto(process.env.E2E_WEB_URL ?? 'http://localhost:5173');

  const metrics = await page.evaluate(async audioModuleUrl => {
    const audio = await import(audioModuleUrl);
    const { AUDIO_CUE_IDS, MUSIC, VOICES, createAudioEngine, setSynthRandom } = audio;
    const sampleRate = 8_000;
    let randomState = 0x51f15e;
    setSynthRandom(() => {
      randomState = (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0;
      return randomState / 0x1_0000_0000;
    });

    const summarize = buffer => {
      const samples = buffer.getChannelData(0);
      let peak = 0;
      let squareSum = 0;
      let nonzero = 0;
      let finite = true;
      for (const sample of samples) {
        if (!Number.isFinite(sample)) finite = false;
        const absolute = Math.abs(sample);
        if (absolute > peak) peak = absolute;
        squareSum += sample * sample;
        if (absolute > 1e-7) nonzero += 1;
      }
      return { finite, peak, rms: Math.sqrt(squareSum / samples.length), nonzero, samples: samples.length };
    };

    const cueMetrics = {};
    for (const cue of [...new Set(Object.values(AUDIO_CUE_IDS))]) {
      const context = new OfflineAudioContext(1, sampleRate * 6, sampleRate);
      VOICES[cue](context, context.destination, 0.01);
      cueMetrics[cue] = summarize(await context.startRendering());
    }

    const trackMetrics = {};
    for (const id of ['table', 'threat', 'shop', 'market', 'after']) {
      const context = new OfflineAudioContext(1, sampleRate * 25, sampleRate);
      const track = MUSIC[id];
      track.bar(context, context.destination, 0.01, 0, 60 / track.bpm);
      trackMetrics[id] = summarize(await context.startRendering());
    }

    const renderEngine = async ({ volume = 1, room = 1, effects = 1, muted = false, music = false }) => {
      const context = new OfflineAudioContext(1, sampleRate * 6, sampleRate);
      const storageValues = new Map();
      const engine = createAudioEngine({
        createContext: () => context,
        storage: {
          getItem: key => storageValues.get(key) ?? null,
          setItem: (key, value) => storageValues.set(key, value),
        },
      });
      engine.setVolume(volume);
      engine.setRoomVolume(room);
      engine.setEffectsVolume(effects);
      engine.setMuted(muted);
      if (music) engine.setMusic('table');
      else engine.play(AUDIO_CUE_IDS.uiConfirm);
      const rendered = summarize(await context.startRendering());
      engine.stopAmbience();
      await engine.dispose();
      return rendered;
    };

    const originalSetInterval = globalThis.setInterval;
    const originalClearInterval = globalThis.clearInterval;
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    const originalDisconnect = AudioNode.prototype.disconnect;
    const liveIntervals = new Set();
    const liveTimeouts = new Set();
    let intervalsCreated = 0;
    let intervalsCleared = 0;
    let timeoutsCreated = 0;
    let timeoutsSettled = 0;
    let disconnects = 0;
    globalThis.setInterval = (callback, delay, ...args) => {
      const id = originalSetInterval(callback, delay, ...args);
      liveIntervals.add(id);
      intervalsCreated += 1;
      return id;
    };
    globalThis.clearInterval = id => {
      if (liveIntervals.delete(id)) intervalsCleared += 1;
      return originalClearInterval(id);
    };
    globalThis.setTimeout = (callback, delay, ...args) => {
      let id;
      id = originalSetTimeout((...callbackArgs) => {
        if (liveTimeouts.delete(id)) timeoutsSettled += 1;
        callback(...callbackArgs);
      }, delay, ...args);
      liveTimeouts.add(id);
      timeoutsCreated += 1;
      return id;
    };
    globalThis.clearTimeout = id => {
      if (liveTimeouts.delete(id)) timeoutsSettled += 1;
      return originalClearTimeout(id);
    };
    AudioNode.prototype.disconnect = function (...args) {
      disconnects += 1;
      return originalDisconnect.apply(this, args);
    };

    let lifecycle;
    try {
      const context = new AudioContext();
      const engine = createAudioEngine({
        createContext: () => context,
        storage: { getItem: () => null, setItem: () => undefined },
      });
      await engine.start();
      engine.setMusic('table');
      engine.setThreat(true);
      await new Promise(resolve => originalSetTimeout(resolve, 220));
      const layered = engine.state();
      engine.setMusic('market');
      engine.setVolume(0.8);
      engine.setRoomVolume(0.25);
      engine.setEffectsVolume(0.75);
      engine.setMuted(true);
      engine.play(AUDIO_CUE_IDS.uiConfirm);
      const muted = engine.state();
      engine.setMuted(false);
      engine.setThreat(false);
      engine.play(AUDIO_CUE_IDS.uiSelect);
      engine.stopAmbience();
      const stopped = engine.state();
      await engine.dispose();
      // Music layer gains disconnect after their fade tails. Let those callbacks
      // run against the already-closed context to catch invalid-state errors.
      await new Promise(resolve => originalSetTimeout(resolve, 5_200));
      lifecycle = {
        contextState: context.state,
        layered,
        muted,
        stopped,
        intervalsCreated,
        intervalsCleared,
        liveIntervals: liveIntervals.size,
        timeoutsCreated,
        timeoutsSettled,
        liveTimeouts: liveTimeouts.size,
        disconnects,
      };
    } finally {
      for (const id of liveIntervals) originalClearInterval(id);
      for (const id of liveTimeouts) originalClearTimeout(id);
      globalThis.setInterval = originalSetInterval;
      globalThis.clearInterval = originalClearInterval;
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
      AudioNode.prototype.disconnect = originalDisconnect;
    }

    return {
      cueMetrics,
      trackMetrics,
      controls: {
        audibleEffect: await renderEngine({}),
        mutedEffect: await renderEngine({ muted: true }),
        zeroEffects: await renderEngine({ effects: 0 }),
        audibleMusic: await renderEngine({ music: true }),
        zeroMusic: await renderEngine({ music: true, room: 0 }),
      },
      lifecycle,
    };
  }, audioModuleUrl);

  const cueEntries = Object.entries(metrics.cueMetrics);
  assert.ok(cueEntries.length >= 70, `expected the complete cue palette, got ${cueEntries.length}`);
  for (const [cue, result] of cueEntries) {
    assert.equal(result.finite, true, `${cue} renders finite samples`);
    assert.ok(result.peak > 1e-6, `${cue} has a measurable peak`);
    assert.ok(result.nonzero > 8, `${cue} has more than an impulse-sized signal`);
  }
  assert.deepEqual(Object.keys(metrics.trackMetrics), ['table', 'threat', 'shop', 'market', 'after']);
  for (const [track, result] of Object.entries(metrics.trackMetrics)) {
    assert.equal(result.finite, true, `${track} renders finite samples`);
    assert.ok(result.peak > 1e-6, `${track} has a measurable peak`);
    assert.ok(result.rms > 1e-6, `${track} has measurable energy`);
  }

  assert.ok(metrics.controls.audibleEffect.peak > 1e-5);
  assert.equal(metrics.controls.mutedEffect.peak, 0);
  assert.equal(metrics.controls.zeroEffects.peak, 0);
  assert.ok(metrics.controls.audibleMusic.peak > 1e-5);
  assert.equal(metrics.controls.zeroMusic.peak, 0);
  assert.deepEqual(metrics.lifecycle.layered.music, 'table');
  assert.equal(metrics.lifecycle.layered.threat, true);
  assert.deepEqual(metrics.lifecycle.muted, {
    volume: 0.8,
    roomVolume: 0.25,
    effectsVolume: 0.75,
    muted: true,
    contextReady: true,
    music: 'market',
    threat: true,
  });
  assert.equal(metrics.lifecycle.stopped.music, undefined);
  assert.equal(metrics.lifecycle.stopped.threat, false);
  assert.equal(metrics.lifecycle.contextState, 'closed');
  assert.equal(metrics.lifecycle.liveIntervals, 0);
  assert.equal(metrics.lifecycle.intervalsCreated, metrics.lifecycle.intervalsCleared);
  assert.equal(metrics.lifecycle.liveTimeouts, 0);
  assert.equal(metrics.lifecycle.timeoutsCreated, metrics.lifecycle.timeoutsSettled);
  assert.ok(metrics.lifecycle.disconnects >= 12, `expected graph teardown disconnects, got ${metrics.lifecycle.disconnects}`);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);

  const cuePeaks = cueEntries.map(([, result]) => result.peak);
  const trackSummary = Object.fromEntries(Object.entries(metrics.trackMetrics).map(([id, result]) => [id, { peak: result.peak, rms: result.rms, nonzero: result.nonzero }]));
  console.log(JSON.stringify({
    cues: { count: cueEntries.length, minPeak: Math.min(...cuePeaks), maxPeak: Math.max(...cuePeaks) },
    tracks: trackSummary,
    controls: metrics.controls,
    lifecycle: metrics.lifecycle,
    browserErrors: { page: pageErrors.length, console: consoleErrors.length },
  }, null, 2));
} finally {
  await browser.close();
}
