// import.meta.env is always defined under Vite; the fallback keeps plain
// Node evaluation (tests) from crashing on module import. Matches client.ts.
const simulatorEnv = (import.meta as ImportMeta & {
  env?: Record<string, string | boolean | undefined>;
}).env ?? {};

export const simulatorEnabled =
  simulatorEnv.MODE !== 'production' &&
  simulatorEnv.VITE_ENABLE_SIMULATOR === 'true';
