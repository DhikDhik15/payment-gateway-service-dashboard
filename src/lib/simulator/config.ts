export const simulatorEnabled =
  import.meta.env.MODE !== 'production' &&
  import.meta.env.VITE_ENABLE_SIMULATOR === 'true';
