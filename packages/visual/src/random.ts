export type RandomSource = () => number;

function hashSeed(seed: number | string): number {
  if (typeof seed === 'number') return seed >>> 0;
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** A tiny deterministic PRNG suitable for repeatable procedural textures. */
export function createSeededRandom(seed: number | string): RandomSource {
  let state = hashSeed(seed) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function deriveSeed(seed: number | string, namespace: string): string {
  return `${String(seed)}:${namespace}`;
}
