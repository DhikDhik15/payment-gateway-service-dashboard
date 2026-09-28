// Client Simulator API key held in memory only. Never persisted, logged, or
// placed in a URL. The key is sent only via the X-API-Key header to the
// External Client API endpoints.

let clientApiKey: string | null = null;

export function setClientApiKey(value: string): void {
  const trimmed = value.trim();
  clientApiKey = trimmed || null;
}

export function getClientApiKey(): string | null {
  return clientApiKey;
}

export function clearClientApiKey(): void {
  clientApiKey = null;
}
