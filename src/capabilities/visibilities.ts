/**
 * The audiences a post can aim at on one instance (decision 5, WFE-172): the
 * four every backend has, plus `local` where the instance carries
 * `localOnlyPosts`. `/vis`, `/set defaultVisibility` and the composer take
 * their words from here, so a Mastodon account is never offered `local`.
 */

import { type Capabilities, hasFeature } from './capabilities';
import type { Visibility } from '../api/schemas/status';

/** The audiences every backend has. */
const BASE_VISIBILITIES: readonly Visibility[] = ['public', 'unlisted', 'private', 'direct'];

/**
 * The audiences an instance with {@link capabilities} offers; the four common
 * ones while the capabilities are not known (null).
 */
export function availableVisibilities(capabilities: Capabilities | null): readonly Visibility[] {
  const local = capabilities !== null && hasFeature(capabilities, 'localOnlyPosts');
  return local ? [...BASE_VISIBILITIES, 'local'] : BASE_VISIBILITIES;
}
