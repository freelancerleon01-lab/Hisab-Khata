// ব্রাউজার ব্যবহারকারীর স্পর্শ ছাড়া শব্দ চালাতে দেয় না, তাই প্রথম স্পর্শেই অডিও চালু করে রাখা হয়
let ctx = null;
let timer = null;

export function unlockAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* ignore */ }
}

function burst() {
  if (ctx) {
    const t0 = ctx.currentTime;
    [0, 0.35, 0.7].forEach((off) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t0 + off);
      g.gain.exponentialRampToValueAtTime(0.5, t0 + off + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.28);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + off);
      o.stop(t0 + off + 0.3);
    });
  }
  try { navigator.vibrate && navigator.vibrate([300, 150, 300, 150, 300]); } catch { /* ignore */ }
}

export function startRing() {
  stopRing();
  unlockAudio();
  burst();
  timer = setInterval(burst, 1800);
}

export function stopRing() {
  clearInterval(timer);
  timer = null;
  try { navigator.vibrate && navigator.vibrate(0); } catch { /* ignore */ }
}
