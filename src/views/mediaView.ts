/**
 * The attachment -> MediaItem mapping postView uses (AGENTS.md "Layout":
 * src/views is the rendering shared by every window). A remote server chooses
 * every attachment URL, so only absolute http(s) URLs survive; anything else
 * becomes null and never reaches an `href` or `src`. Pure.
 */

import type { MediaAttachment } from '../api/schemas/mediaAttachment';
import { isHttpUrl } from '../lib/url';
import type { MediaItem } from '../ui/MediaList';

/** The URL when it is absolute http(s), else null. */
function httpOrNull(url: string | null): string | null {
  return url !== null && isHttpUrl(url) ? url : null;
}

/** One attachment in the row's own field names; non-http(s) URLs become null. */
export function mediaItem(attachment: MediaAttachment): MediaItem {
  return {
    id: attachment.id,
    type: attachment.type,
    url: httpOrNull(attachment.url),
    previewUrl: httpOrNull(attachment.preview_url),
    description: attachment.description,
  };
}
