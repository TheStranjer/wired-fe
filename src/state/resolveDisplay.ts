/**
 * Which display values a window actually uses (decision 15): the reader's
 * `density`, `avatars` and `images` settings, each replaced by the window's
 * own override when it has one. Pure, no React.
 */

import type { Density, Settings } from './settings';
import type { DisplayOverrides } from '../windows/model';

/** The three display values in force for one window. */
export type ResolvedDisplay = {
  readonly density: Density;
  readonly avatars: boolean;
  readonly images: boolean;
};

/** {@link settings} with every key {@link overrides} sets taken from the override. */
export function resolveDisplay(
  settings: Pick<Settings, 'density' | 'avatars' | 'images'>,
  overrides: DisplayOverrides,
): ResolvedDisplay {
  return {
    density: overrides.density ?? settings.density,
    avatars: overrides.avatars ?? settings.avatars,
    images: overrides.images ?? settings.images,
  };
}
