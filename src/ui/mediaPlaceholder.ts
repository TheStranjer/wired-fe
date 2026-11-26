/**
 * The text of an attachment's placeholder line, `[IMG 1/2: a wall]`, in the
 * language in use (decision 19): the word each kind earns, and the line that
 * puts it with the attachment's place and description. Pure; the caller passes
 * the `t` it got from `useT()`, so the line follows a language change.
 */
import type { Translate } from '../i18n/messages';

/** What an attachment is, as far as the placeholder and the player are concerned. */
export type MediaKind = 'image' | 'gifv' | 'video' | 'audio' | 'unknown';

/** What the placeholder reads from an attachment. */
type Described = {
  readonly type: MediaKind;
  readonly description: string | null;
};

/** The word {@link type} earns inside its placeholder. */
function kindLabel(type: MediaKind, t: Translate): string {
  switch (type) {
    case 'image':
      return t('ui.media_list.kind_image');
    case 'gifv':
      return t('ui.media_list.kind_gif');
    case 'video':
      return t('ui.media_list.kind_video');
    case 'audio':
      return t('ui.media_list.kind_audio');
    case 'unknown':
      return t('ui.media_list.kind_file');
  }
}

/** The placeholder of one attachment, by its place among the post's: `[IMG 1/2: a wall]`. */
export function placeholder(
  item: Described,
  place: { readonly index: number; readonly total: number },
  t: Translate,
): string {
  return t('ui.media_list.placeholder', {
    kind: kindLabel(item.type, t),
    number: place.index + 1,
    total: place.total,
    description: item.description ?? t('ui.media_list.no_description'),
  });
}
