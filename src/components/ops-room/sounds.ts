// Simple sound effects using Web Audio API
// No external audio files needed

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function playTone(freq: number, duration: number, volume: number = 0.1, type: OscillatorType = "sine") {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available
  }
}

// Notification: soft ping (task complete, approval needed)
export function playNotification() {
  playTone(800, 0.15, 0.08);
  setTimeout(() => playTone(1000, 0.1, 0.06), 100);
}

// Success: ascending two-note chime
export function playSuccess() {
  playTone(600, 0.12, 0.07);
  setTimeout(() => playTone(900, 0.15, 0.07), 120);
}

// Error: low descending tone
export function playError() {
  playTone(400, 0.2, 0.08, "square");
  setTimeout(() => playTone(300, 0.25, 0.06, "square"), 150);
}

// Click: subtle tick
export function playClick() {
  playTone(1200, 0.05, 0.04);
}

// Approval: happy rising arpeggio
export function playApproval() {
  playTone(500, 0.1, 0.06);
  setTimeout(() => playTone(700, 0.1, 0.06), 80);
  setTimeout(() => playTone(900, 0.15, 0.06), 160);
}
