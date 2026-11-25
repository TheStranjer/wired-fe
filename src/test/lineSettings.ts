/**
 * Settings that draw posts as IRC lines, for the tests that assert the line
 * rendering's specifics now that cards are the default (decision 15).
 */

import { DEFAULT_SETTINGS, type Settings } from '../state/settings';

/** The default settings with `density` set to `lines`. */
export const LINE_SETTINGS: Settings = { ...DEFAULT_SETTINGS, density: 'lines' };
