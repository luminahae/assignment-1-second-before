/* =========================================================================
 * audio.js — Web Audio API 기반 효과음 (외부 음원 파일 없음)
 * 브라우저 정책상 사용자 상호작용(클릭) 이후에만 소리가 납니다.
 * ======================================================================= */

const SFX = (() => {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* 단순 톤 하나를 만든다 */
  function tone(freq, dur, type = 'sine', vol = 0.15, when = 0) {
    const c = ensure();
    if (!c || muted) return;
    const t0 = c.currentTime + when;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /* 주파수 슬라이드(글리산도) */
  function slide(f1, f2, dur, type = 'sawtooth', vol = 0.12) {
    const c = ensure();
    if (!c || muted) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f1, t0);
    osc.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /* 노이즈 버스트(윈도우 오류음 느낌) */
  function noise(dur = 0.12, vol = 0.12) {
    const c = ensure();
    if (!c || muted) return;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
    const src = c.createBufferSource();
    const gain = c.createGain();
    src.buffer = buf;
    gain.gain.setValueAtTime(vol, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    src.connect(gain).connect(c.destination);
    src.start();
  }

  return {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },

    click()   { tone(660, 0.06, 'square', 0.10); },
    open()    { tone(880, 0.05, 'triangle', 0.10); tone(1180, 0.06, 'triangle', 0.08, 0.05); },
    error()   { noise(0.10, 0.10); tone(160, 0.22, 'sawtooth', 0.14); },
    message() { tone(1046, 0.07, 'sine', 0.12); tone(1318, 0.09, 'sine', 0.10, 0.08); },
    warn()    { tone(440, 0.10, 'square', 0.13); tone(440, 0.10, 'square', 0.13, 0.14); },
    tick()    { tone(1500, 0.03, 'square', 0.08); },
    success() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'triangle', 0.13, i * 0.10)); },
    fail()    { slide(400, 80, 0.7, 'sawtooth', 0.16); },
    uploadDone() { [784, 1046, 1318].forEach((f, i) => tone(f, 0.12, 'sine', 0.12, i * 0.07)); },
    pop()     { tone(300, 0.05, 'square', 0.08); },
  };
})();

window.SFX = SFX;
