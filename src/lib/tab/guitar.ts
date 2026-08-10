/**
 * A plucked-string synthesiser, built with Karplus-Strong.
 *
 * Fill a buffer the length of one wave period with noise, then repeatedly
 * average it with itself one period back. High frequencies cancel faster than
 * low ones, which is exactly what a real string does — so a few lines of
 * arithmetic sound far more like a guitar than any oscillator, and it needs no
 * samples to download.
 */

const MAX_SECONDS = 2.5;
/** Per-sample feedback. Higher rings longer; above ~0.999 it never decays. */
const DECAY = 0.996;

export function midiToFrequency(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function renderPluck(ctx: BaseAudioContext, midi: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const period = Math.max(2, Math.round(rate / midiToFrequency(midi)));
  const length = Math.floor(rate * MAX_SECONDS);
  const buffer = ctx.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);

  // Seed one period with noise, lightly smoothed so the attack is warm rather
  // than fizzy.
  let previous = 0;
  for (let i = 0; i < period; i++) {
    const noise = Math.random() * 2 - 1;
    previous = (noise + previous) * 0.5;
    data[i] = previous;
  }

  for (let i = period; i < length; i++) {
    data[i] = ((data[i - period] ?? 0) + (data[i - period + 1] ?? 0)) * 0.5 * DECAY;
  }

  // Fade the tail so a truncated buffer never clicks.
  const fade = Math.floor(rate * 0.05);
  for (let i = 0; i < fade; i++) {
    const at = length - fade + i;
    const sample = data[at];
    if (sample !== undefined) data[at] = sample * (1 - i / fade);
  }

  return buffer;
}

export type Guitar = {
  /** Schedule a note. `when` is an AudioContext timestamp. */
  pluck(midi: number, when: number, gain?: number): void;
  /** Silence everything currently ringing. */
  stopAll(): void;
  readonly output: GainNode;
};

export function createGuitar(ctx: AudioContext): Guitar {
  const output = ctx.createGain();
  output.gain.value = 0.35;
  output.connect(ctx.destination);

  // Rendering a buffer costs a few milliseconds, so keep one per pitch.
  const cache = new Map<number, AudioBuffer>();
  let live: AudioBufferSourceNode[] = [];

  return {
    output,
    pluck(midi, when, gain = 1) {
      if (midi < 24 || midi > 108) return;

      let buffer = cache.get(midi);
      if (!buffer) {
        buffer = renderPluck(ctx, midi);
        cache.set(midi, buffer);
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const level = ctx.createGain();
      level.gain.value = gain;

      source.connect(level).connect(output);
      source.start(when);
      source.onended = () => {
        live = live.filter((s) => s !== source);
      };
      live.push(source);
    },
    stopAll() {
      for (const source of live) {
        try {
          source.stop();
        } catch {
          // Already finished; nothing to stop.
        }
      }
      live = [];
    },
  };
}
