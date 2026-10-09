/** Serializable xorshift32. No wall clock or ambient randomness enters gameplay. */
export class SeededRandom {
  state: number;
  constructor(seed: number) {
    if (!Number.isSafeInteger(seed)) throw new Error('A finite integer seed is required.');
    this.state = (seed >>> 0) || 0x6d2b79f5;
  }
  next(): number {
    let value = this.state;
    value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
    this.state = value >>> 0;
    return this.state / 0x100000000;
  }
  int(length: number): number {
    if (!Number.isInteger(length) || length < 1) throw new Error('Cannot choose from an empty pool.');
    return Math.floor(this.next() * length);
  }
  pick<T>(values: readonly T[]): T { return values[this.int(values.length)]!; }
  shuffle<T>(values: readonly T[]): T[] {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const other = this.int(index + 1);
      [result[index], result[other]] = [result[other]!, result[index]!];
    }
    return result;
  }
}
