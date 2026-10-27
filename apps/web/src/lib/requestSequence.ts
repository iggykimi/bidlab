// Last-response-wins helper for debounced backend calls (price evaluation, T22).

export class LatestOnly {
  private current: AbortController | null = null;

  signal(): AbortSignal {
    this.current?.abort();
    this.current = new AbortController();
    return this.current.signal;
  }

  abort(): void {
    this.current?.abort();
    this.current = null;
  }
}
