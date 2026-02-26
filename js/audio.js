/**
 * 天穹 · 音效与背景音乐（Web Audio API，无外部资源）
 */
window.GAME_AUDIO = (function () {
  let ctx = null;
  let bgmGain = null;
  let bgmInterval = null;
  let muted = false;

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      bgmGain = ctx.createGain();
      bgmGain.gain.value = 0.25;
      bgmGain.connect(ctx.destination);
    }
    return ctx;
  }

  function playTone(opt) {
    const audioCtx = getCtx();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = opt.type || 'sine';
    osc.frequency.setValueAtTime(opt.freq, now);
    osc.frequency.exponentialRampToValueAtTime(opt.freqEnd ?? opt.freq, now + (opt.dur ?? 0.08));
    gain.gain.setValueAtTime(opt.vol ?? 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (opt.dur ?? 0.08));
    osc.start(now);
    osc.stop(now + (opt.dur ?? 0.08));
  }

  function playNoise(opt) {
    const audioCtx = getCtx();
    const now = audioCtx.currentTime;
    const bufSize = audioCtx.sampleRate * (opt.dur ?? 0.12);
    const buffer = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (opt.vol ?? 0.2);
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(opt.vol ?? 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (opt.dur ?? 0.12));
    src.connect(gain);
    gain.connect(audioCtx.destination);
    src.start(now);
    src.stop(now + (opt.dur ?? 0.12));
  }

  function guard(fn) {
    return function () { if (!muted) fn.apply(null, arguments); };
  }

  return {
    setMuted(v) { muted = !!v; },
    playShoot: guard(function () {
      playTone({ freq: 880, freqEnd: 600, dur: 0.05, vol: 0.08, type: 'square' });
    }),
    playExplosion: guard(function () {
      playNoise({ dur: 0.15, vol: 0.18 });
      playTone({ freq: 180, freqEnd: 80, dur: 0.12, vol: 0.1, type: 'sawtooth' });
    }),
    playCombo: guard(function () {
      playTone({ freq: 880, dur: 0.04, vol: 0.06 });
      playTone({ freq: 1100, dur: 0.05, vol: 0.05 });
    }),
    playBossKill: guard(function () {
      playNoise({ dur: 0.2, vol: 0.2 });
      playTone({ freq: 220, freqEnd: 80, dur: 0.2, vol: 0.12, type: 'sawtooth' });
      playTone({ freq: 440, dur: 0.08, vol: 0.08 });
    }),
    playPlayerHit: guard(function () {
      playTone({ freq: 200, dur: 0.2, vol: 0.2, type: 'sawtooth' });
      playNoise({ dur: 0.1, vol: 0.15 });
    }),
    playPowerUp: guard(function () {
      playTone({ freq: 523, dur: 0.06, vol: 0.12 });
      playTone({ freq: 659, dur: 0.06, vol: 0.1 });
      playTone({ freq: 784, dur: 0.12, vol: 0.1 });
    }),
    playGameOver: guard(function () {
      playTone({ freq: 400, freqEnd: 200, dur: 0.4, vol: 0.15, type: 'sawtooth' });
      playNoise({ dur: 0.25, vol: 0.12 });
    }),
    startBGM() {
      if (muted) return;
      const audioCtx = getCtx();
      if (bgmInterval) return;
      const seq = [
        { f: 262, t: 0 }, { f: 330, t: 0.25 }, { f: 392, t: 0.5 }, { f: 523, t: 0.75 },
        { f: 392, t: 1 }, { f: 330, t: 1.25 }, { f: 262, t: 1.5 }, { f: 0, t: 2 },
      ];
      let step = 0;
      function tick() {
        const s = seq[step % seq.length];
        if (s.f > 0) {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(bgmGain);
          osc.type = 'sine';
          osc.frequency.value = s.f;
          gain.gain.setValueAtTime(0, audioCtx.currentTime);
          gain.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
          osc.start(audioCtx.currentTime);
          osc.stop(audioCtx.currentTime + 0.35);
        }
        step++;
      }
      tick();
      bgmInterval = setInterval(tick, 400);
    },
    stopBGM() {
      if (bgmInterval) {
        clearInterval(bgmInterval);
        bgmInterval = null;
      }
    },
    resume() {
      const c = getCtx();
      if (c.state === 'suspended') c.resume();
    },
  };
})();
