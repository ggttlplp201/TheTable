/** Coordinates one reconnect attempt per Socket.IO connection generation. */
export class ConnectionRestoreGate {
  private generation = 0;
  private activeGeneration: number | undefined;

  nextConnection(): number {
    this.generation += 1;
    return this.generation;
  }

  begin(generation: number): boolean {
    if (this.activeGeneration === generation) return false;
    this.activeGeneration = generation;
    return true;
  }

  isCurrent(generation: number): boolean {
    return this.activeGeneration === generation;
  }

  isLatest(generation: number): boolean {
    return this.generation === generation;
  }

  complete(generation: number): void {
    if (this.activeGeneration === generation) this.activeGeneration = undefined;
  }
}

export function shouldForgetRestoreSession(code: string): boolean {
  return code === 'INVALID_SESSION' || code === 'ROOM_NOT_FOUND';
}
