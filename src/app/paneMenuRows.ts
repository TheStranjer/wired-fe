/**
 * The fixed rows of the pane menus (WFE-229, WFE-269, WFE-270; decision 13):
 * the one before the saved feeds and the views after them, each with the
 * command it needs, the view it opens and, for a row that needs one argument,
 * what its dialog asks. Pure; the text of a row is worded in the language in
 * use when the rows are built, never at module load (decision 19).
 */

import type { PaneAsk } from './paneAsk';
import type { Translate } from '../i18n/messages';

/** A row of the fixed part of the menu: the command it needs and the view it opens. */
export type Row = {
  readonly id: string;
  readonly label: string;
  /** The command the view needs; null for a row that needs none. */
  readonly needs: string | null;
  readonly view: string;
  readonly pick: 'window' | null;
  readonly ask: PaneAsk | null;
};

/** A row that runs `view` at once. */
function plain(id: string, label: string, view = id): Row {
  return { id, label, needs: id, view, pick: null, ask: null };
}

/** A row whose view is finished by the answer to {@link ask}. */
function asking(row: Pick<Row, 'id' | 'label' | 'needs' | 'ask'>): Row {
  return { ...row, view: row.id, pick: null };
}

/** The rows before the saved feeds. */
export function headRows(t: Translate): readonly Row[] {
  return [
    { id: 'same', label: t('app.menu_same_window'), needs: null, view: '', pick: null, ask: null },
  ];
}

/** The rows that ask for an argument in a dialog: a hashtag, a search, a profile and a direct message. */
function askingRows(t: Translate): readonly Row[] {
  return [
    asking({
      id: 'tag',
      label: t('app.menu_hashtag'),
      needs: 'tag',
      ask: {
        title: t('app.ask_hashtag_title'),
        placeholder: t('app.ask_hashtag_placeholder'),
        suggest: 'tags',
      },
    }),
    asking({
      id: 'search',
      label: t('app.menu_search'),
      needs: 'search',
      ask: {
        title: t('app.ask_search_title'),
        placeholder: t('app.ask_search_placeholder'),
        suggest: null,
      },
    }),
    asking({
      id: 'whois',
      label: t('app.menu_profile'),
      needs: 'whois',
      ask: {
        title: t('app.ask_profile_title'),
        placeholder: t('app.ask_handle_placeholder'),
        suggest: 'accounts',
      },
    }),
    asking({
      id: 'dm',
      label: t('app.menu_dm'),
      needs: 'query',
      ask: {
        title: t('app.ask_dm_title'),
        placeholder: t('app.ask_handle_placeholder'),
        suggest: 'accounts',
      },
    }),
  ];
}

/** The rows after the saved feeds. */
export function tailRows(t: Translate): readonly Row[] {
  return [
    plain('composer', t('app.menu_composer')),
    plain('home', t('app.menu_home')),
    plain('notifications', t('app.menu_notifications')),
    plain('local', t('app.menu_local')),
    plain('federated', t('app.menu_federated')),
    plain('dms', t('app.menu_dms')),
    plain('people', t('app.menu_people'), '/people'),
    ...askingRows(t),
    {
      id: 'win',
      label: t('app.menu_existing_window'),
      needs: 'win',
      view: 'win',
      pick: 'window',
      ask: null,
    },
  ];
}
