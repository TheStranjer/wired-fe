/**
 * The build-time configuration of this bundle (decision 3): the constant Vite
 * injected from the validated config file. There is no runtime config fetch;
 * this is the app's only view of deployment settings.
 */
import type { WiredConfig } from './schema';

/** The configuration this bundle was built with. */
export const buildConfig: WiredConfig = __WIRED_CONFIG__;
