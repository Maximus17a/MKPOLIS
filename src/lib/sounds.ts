let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function playTone(freq: number, duration: number, volume = 0.08, type: OscillatorType = 'sine') {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = freq;
  osc.type = type;
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.start(now);
  osc.stop(now + duration);
}

// Emote sounds — each emote has a distinct short melody/tone
const EMOTE_SOUNDS: Record<string, () => void> = {
  laugh: () => {
    playTone(523, 0.08, 0.06); // C
    setTimeout(() => playTone(659, 0.08, 0.06), 60); // E
    setTimeout(() => playTone(784, 0.1, 0.07), 120); // G
  },
  poop: () => {
    playTone(200, 0.15, 0.06, 'sawtooth');
    setTimeout(() => playTone(150, 0.2, 0.05, 'sawtooth'), 100);
  },
  angry: () => {
    playTone(300, 0.1, 0.07, 'square');
    setTimeout(() => playTone(250, 0.15, 0.06, 'square'), 80);
  },
  confetti: () => {
    playTone(523, 0.06, 0.05);
    setTimeout(() => playTone(659, 0.06, 0.05), 50);
    setTimeout(() => playTone(784, 0.06, 0.05), 100);
    setTimeout(() => playTone(1047, 0.12, 0.06), 150);
  },
  skull: () => {
    playTone(220, 0.2, 0.06, 'triangle');
    setTimeout(() => playTone(165, 0.3, 0.05, 'triangle'), 150);
  },
  fire: () => {
    playTone(440, 0.06, 0.05);
    setTimeout(() => playTone(554, 0.06, 0.05), 50);
    setTimeout(() => playTone(659, 0.08, 0.06), 100);
  },
  gg: () => {
    playTone(392, 0.08, 0.05); // G
    setTimeout(() => playTone(494, 0.08, 0.05), 70); // B
    setTimeout(() => playTone(587, 0.08, 0.05), 140); // D
    setTimeout(() => playTone(784, 0.15, 0.07), 210); // G high
  },
  cry: () => {
    playTone(440, 0.15, 0.05, 'triangle');
    setTimeout(() => playTone(392, 0.2, 0.05, 'triangle'), 120);
    setTimeout(() => playTone(349, 0.25, 0.04, 'triangle'), 240);
  },
};

export function playEmoteSound(emoteId: string) {
  const fn = EMOTE_SOUNDS[emoteId];
  if (fn) fn();
  else playTone(600, 0.1, 0.05); // fallback
}

// Chat message sound — subtle pop
export function playChatSound() {
  playTone(800, 0.05, 0.04);
  setTimeout(() => playTone(1000, 0.06, 0.04), 40);
}

// Chat send sound — slightly different
export function playChatSendSound() {
  playTone(600, 0.04, 0.04);
  setTimeout(() => playTone(900, 0.06, 0.05), 50);
}
