// Development-only simulator credential held in memory. It is intentionally not
// persisted, placed in a URL, or logged. Production builds do not expose the
// simulator routes.
let simulatorApiKey: string | null = null;

export function setSimulatorApiKey(value: string): void {
  const trimmed = value.trim();
  simulatorApiKey = trimmed || null;
}

export function getSimulatorApiKey(): string | null {
  return simulatorApiKey;
}

export function clearSimulatorApiKey(): void {
  simulatorApiKey = null;
}
