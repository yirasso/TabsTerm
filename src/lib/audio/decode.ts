"use client";

/**
 * Audio in, mono samples out. Everything downstream — chord recognition and
 * note detection alike — wants one channel at a known rate, and both models
 * were trained at 22050 Hz.
 */

export const MODEL_SAMPLE_RATE = 22050;
/** Longer than this and the browser tab suffers; enough for most songs. */
export const MAX_SECONDS = 300;

export type MonoAudio = {
  samples: Float32Array;
  sampleRate: number;
  duration: number;
};

/** Mix to mono and resample, using an OfflineAudioContext to do the work. */
export async function toMono(buffer: AudioBuffer, sampleRate = MODEL_SAMPLE_RATE) {
  const seconds = Math.min(buffer.duration, MAX_SECONDS);
  const frames = Math.ceil(seconds * sampleRate);

  const offline = new OfflineAudioContext(1, frames, sampleRate);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();

  const rendered = await offline.startRendering();
  return {
    samples: rendered.getChannelData(0).slice(),
    sampleRate,
    duration: seconds,
  } satisfies MonoAudio;
}

/** Decode a file the user picked. Never leaves the browser. */
export async function decodeFile(file: File): Promise<MonoAudio> {
  const ctx = new AudioContext();
  try {
    const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
    return await toMono(buffer);
  } finally {
    void ctx.close();
  }
}

/** Decode a recording captured from the microphone. */
export async function decodeBlob(blob: Blob): Promise<MonoAudio> {
  const ctx = new AudioContext();
  try {
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
    return await toMono(buffer);
  } finally {
    void ctx.close();
  }
}
