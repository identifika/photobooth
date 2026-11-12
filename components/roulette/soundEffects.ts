/**
 * Web Audio API synthesizer for Photo Roulette.
 * Generates fun, authentic sound effects with zero external asset dependencies!
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Click sound as the roulette wheel ticks past poses
 */
export function playRouletteTick() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(600 + Math.random() * 200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  } catch (e) {
    console.debug("Audio play tick error", e);
  }
}

/**
 * Cheerful chime when a pose is selected by the roulette
 */
export function playPoseSelected() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

      gain.gain.setValueAtTime(0.18, ctx.currentTime + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.08);
      osc.stop(ctx.currentTime + idx * 0.08 + 0.25);
    });
  } catch (e) {
    console.debug("Audio play pose selected error", e);
  }
}

/**
 * Countdown beep (seconds remaining 10..1)
 */
export function playCountdownBeep(secondsLeft: number) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const isUrgent = secondsLeft <= 3;
    const freq = isUrgent ? (secondsLeft === 1 ? 987.77 : 783.99) : 440; // B5, G5, or A4
    const duration = isUrgent ? 0.12 : 0.08;

    osc.type = isUrgent ? "sine" : "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(isUrgent ? 0.25 : 0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    console.debug("Audio play countdown beep error", e);
  }
}

/**
 * Realistic camera shutter click with snap and mechanical wind
 */
export function playCameraShutter() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const bufferSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1200;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start();

    // Secondary click (shutter curtain)
    setTimeout(() => {
      if (!ctx) return;
      try {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.06);
        g.gain.setValueAtTime(0.2, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.06);
      } catch {}
    }, 70);
  } catch (e) {
    console.debug("Audio play shutter error", e);
  }
}

/**
 * Grand fanfare when all 4 rounds finish and the photo strip is ready!
 */
export function playFanfare() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const chords = [
      { notes: [523.25, 659.25, 783.99], time: 0, dur: 0.2 }, // C
      { notes: [587.33, 739.99, 880.0], time: 0.22, dur: 0.2 }, // D
      { notes: [659.25, 830.61, 987.77], time: 0.44, dur: 0.25 }, // E
      { notes: [1046.5, 1318.5, 1567.98], time: 0.72, dur: 0.6 }, // High C Major
    ];

    chords.forEach((chord) => {
      chord.notes.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + chord.time);

        gain.gain.setValueAtTime(0.14, ctx.currentTime + chord.time);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + chord.time + chord.dur
        );

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + chord.time);
        osc.stop(ctx.currentTime + chord.time + chord.dur);
      });
    });
  } catch (e) {
    console.debug("Audio fanfare error", e);
  }
}
