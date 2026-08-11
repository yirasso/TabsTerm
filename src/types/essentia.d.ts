/**
 * essentia.js ships no types. Rather than reach for `any`, this describes only
 * the surface `src/lib/audio/chords.ts` actually uses — which doubles as a
 * record of the pipeline's shape.
 *
 * Vectors are WASM-owned and must be freed with `delete()`.
 */

declare module "essentia.js/dist/essentia-wasm.web.js" {
  export type EssentiaWasmModule = Record<string, unknown>;
  /** Newer builds export a factory; older ones export the module directly. */
  export const EssentiaWASM: EssentiaWasmModule | (() => Promise<EssentiaWasmModule>);
}

declare module "essentia.js/dist/essentia.js-core.es.js" {
  export interface EssentiaVector<T> {
    size(): number;
    get(index: number): T;
    delete(): void;
  }

  export type VectorFloat = EssentiaVector<number>;
  export interface VectorVectorFloat extends EssentiaVector<VectorFloat> {
    push_back(value: VectorFloat): void;
  }

  export default class Essentia {
    constructor(wasm: unknown, isDebug?: boolean);

    /** The Embind module, for the vector types that have no JS helper. */
    module: { VectorVectorFloat: new () => VectorVectorFloat };

    arrayToVector(array: Float32Array | number[]): VectorFloat;
    vectorToArray(vector: VectorFloat): Float32Array;

    FrameGenerator(
      signal: Float32Array | number[],
      frameSize: number,
      hopSize: number,
    ): VectorVectorFloat;

    Windowing(
      frame: VectorFloat,
      normalized?: boolean,
      size?: number,
      type?: string,
    ): { frame: VectorFloat };

    Spectrum(frame: VectorFloat, size?: number): { spectrum: VectorFloat };

    SpectralPeaks(spectrum: VectorFloat): {
      frequencies: VectorFloat;
      magnitudes: VectorFloat;
    };

    HPCP(frequencies: VectorFloat, magnitudes: VectorFloat): { hpcp: VectorFloat };

    /**
     * Reads chord names off a sequence of harmonic pitch class profiles.
     *
     * `chords` comes back as a WASM string vector in some builds and a plain
     * array in others, so callers have to cope with both.
     */
    ChordsDetection(
      pcp: VectorFloat | VectorVectorFloat,
      hopSize: number,
      sampleRate: number,
      windowSize: number,
    ): { chords: EssentiaVector<string> | string[]; strength: VectorFloat };
  }
}
