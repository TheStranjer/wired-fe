/**
 * The build-time configuration injected into the bundle as a compile-time
 * constant (decision 3): Vite defines it from the validated config file
 * loaded by tooling/loadConfig.ts. See src/config/config.ts for the app's
 * typed view of it.
 */
import type { WiredConfig } from './schema';

declare global {
  const __WIRED_CONFIG__: WiredConfig;
}
