export type PerformanceWarning = "software" | "caveat" | "slow";

/** Hints only: browsers do not expose the hardware-acceleration preference. */
export function accelerationWarning(
  gl: WebGL2RenderingContext,
  majorCaveat: boolean,
): PerformanceWarning | null {
  try {
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = info
      ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))
      : "";
    if (
      /swiftshader|llvmpipe|softpipe|software|swrast|lavapipe|microsoft basic render/i.test(
        renderer,
      )
    )
      return "software";
  } catch {
    // Renderer details may be withheld by privacy settings.
  }
  return majorCaveat ? "caveat" : null;
}

/** Three consecutive slow two-second windows, after loading/foreground warmup. */
export class FramePerformanceMonitor {
  private readyAt: number;
  private start: number | null = null;
  private frames = 0;
  private slowWindows = 0;
  private reported = false;

  constructor(now: number) {
    this.readyAt = now + 8000;
  }

  suspend(now: number) {
    this.readyAt = Math.max(this.readyAt, now + 2000);
    this.start = null;
    this.frames = 0;
    this.slowWindows = 0;
  }

  sample(now: number): boolean {
    if (this.reported || now < this.readyAt) return false;
    if (this.start === null) {
      this.start = now;
      return false;
    }
    this.frames++;
    const duration = now - this.start;
    if (duration < 2000) return false;
    const fps = (this.frames * 1000) / duration;
    this.slowWindows = fps < 24 ? this.slowWindows + 1 : 0;
    this.start = now;
    this.frames = 0;
    this.reported = this.slowWindows >= 3;
    return this.reported;
  }
}
