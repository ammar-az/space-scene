/** Shared by background and world renderers. Reading twice in a frame never advances twice. */
export class SceneClock {
  elapsed = 0;
  private last: number | null = null;
  private playing = true;
  private speed = 1;
  private suspended = false;
  private reduced = false;
  sample(now: number): number {
    if (this.last !== null && this.playing && !this.suspended && !this.reduced)
      this.elapsed += (Math.max(0, now - this.last) / 1000) * this.speed;
    this.last = now;
    return this.elapsed;
  }
  configure(playing: boolean, speed: number, now: number) {
    this.sample(now);
    this.playing = playing;
    this.speed = speed;
  }
  suspend(suspended: boolean, now: number) {
    this.sample(now);
    this.suspended = suspended;
  }
  reduce(reduced: boolean, now: number) {
    this.sample(now);
    this.reduced = reduced;
  }
  seek(elapsed: number, now: number) {
    this.elapsed = elapsed;
    this.last = now;
  }
  reset(now: number) {
    this.seek(0, now);
  }
}
