/**
 * The start menu (WFE-299, decisions 6, 12 and 13): the `[≡ wired]` button at
 * the left of the status line and the list of views it opens, the one place
 * that opens a view as a float. The list is the shared ./ViewList with the
 * command `float`, so a row runs `/float <view>` and a row that asks opens
 * the pane menus' dialog. Whether it is open lives in the app state, so
 * `/start`, its hotkeys and a click on the button all open the same menu; Esc
 * closes it and gives focus back to the button, as does a click outside it.
 * Its last row, `Language…` (WFE-310), runs `/lang --pick`, which swaps the
 * views for the list of interface languages (./LanguageList, the
 * `languageMenu` flag of the app state) until a language is chosen, whose
 * row runs `/lang <code>`. The `/lang` hotkeys open the same list.
 */
import { useEffect, useId, useMemo, useRef } from 'react';
import type { JSX } from 'react';

import { LanguageList } from './LanguageList';
import { startMenuEntries } from './launcherEntries';
import { paneMenuEntries } from './paneMenu';
import type { PaneMenuEntry } from './paneMenu';
import styles from './StartMenu.module.css';
import { useAvailableRegistry } from './useAvailableRegistry';
import { useStartDismiss } from './useStartDismiss';
import { ViewList } from './ViewList';
import { useT } from '../i18n/I18nProvider';
import { useAppDispatch, useAppState } from '../state/StateContext';
import type { PostActionLine } from '../ui/postActionTypes';
import { usePostActions } from '../views/PostActionsContext';

/** The row that opens the list of languages: it runs `/lang --pick`, as the hotkeys do. */
function languageEntry(label: string): PaneMenuEntry {
  return {
    id: 'language',
    label,
    text: '/lang --pick',
    literal: true,
    pick: null,
    ask: null,
  };
}

/** The way to close both lists of the menu. */
function useClose(): () => void {
  const dispatch = useAppDispatch();
  return () => {
    dispatch({ type: 'startMenu', open: false });
    dispatch({ type: 'languageMenu', open: false });
  };
}

/** The open list of views, id `id`: it takes focus on its first row as it opens, and a chosen row closes the menu and runs its line. */
function StartPopup(props: { readonly id: string; readonly close: () => void }): JSX.Element {
  const registry = useAvailableRegistry();
  const { settings } = useAppState();
  const { run } = usePostActions();
  const popupRef = useRef<HTMLDivElement | null>(null);
  const t = useT();
  const entries = useMemo(
    () => [
      ...startMenuEntries(paneMenuEntries(registry, settings.feeds, t)),
      languageEntry(t('app.language_row')),
    ],
    [registry, settings.feeds, t],
  );
  useEffect(() => {
    popupRef.current?.querySelector('button')?.focus();
  }, []);
  const choose = (line: PostActionLine): void => {
    props.close();
    run(line);
  };
  return (
    <div className={styles['popup']} id={props.id} ref={popupRef}>
      <ViewList command="float" entries={entries} label={t('app.open_view_float')} run={choose} />
    </div>
  );
}

/** The open list of languages, id `id`: it takes focus on its first row as it opens, and a chosen row closes the menu and runs `/lang`. */
function LanguagePopup(props: { readonly id: string; readonly close: () => void }): JSX.Element {
  const { run } = usePostActions();
  const popupRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    popupRef.current?.querySelector('button')?.focus();
  }, []);
  return (
    <div className={styles['popup']} id={props.id} ref={popupRef}>
      <LanguageList
        run={(line) => {
          props.close();
          run(line);
        }}
      />
    </div>
  );
}

/** The start menu: its button, and its list of views (or of languages) while it is open. */
export function StartMenu(): JSX.Element {
  const { startMenu, languageMenu } = useAppState();
  const t = useT();
  const close = useClose();
  const dispatch = useAppDispatch();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();
  const open = startMenu || languageMenu;
  useStartDismiss({ open, rootRef, buttonRef, close });
  return (
    <div className={styles['root']} ref={rootRef}>
      <button
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-label={t('app.start_menu_label')}
        className={styles['button']}
        onClick={() => {
          if (open) {
            close();
          } else {
            dispatch({ type: 'startMenu', open: true });
          }
        }}
        ref={buttonRef}
        type="button"
      >
        [≡ wired]
      </button>
      {languageMenu ? <LanguagePopup id={menuId} close={close} /> : null}
      {startMenu && !languageMenu ? <StartPopup id={menuId} close={close} /> : null}
    </div>
  );
}
