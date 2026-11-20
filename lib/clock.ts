import { performance } from "node:perf_hooks";

const clock = globalThis as typeof globalThis & { dirigentClockStartedAt?: number };
clock.dirigentClockStartedAt ??= performance.now();

export function resetClock() {
  clock.dirigentClockStartedAt = performance.now();
}

export function now(): Date {
  const start = Date.parse(process.env.DEMO_NOW ?? "");
  if (!Number.isFinite(start)) return new Date();

  return new Date(start + performance.now() - (clock.dirigentClockStartedAt ?? 0));
}
