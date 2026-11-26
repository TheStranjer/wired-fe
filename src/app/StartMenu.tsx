/**
 * The start menu (WFE-299, decisions 6, 12 and 13): the `[≡ wired]` button at
 * the left of the status line and the list of views it opens, the one place
 * that opens a view as a float. The list is the shared ./ViewList with the
 * command `float`, so a row runs `/float <view>` and a row that asks opens
 * the pane menus' dialog. Whether it is open lives in the app state, so
 * `/start`, its hotkeys and a click on the button all open the same menu; Esc
 * closes it and gives focus back to the button, as does a click outside it.
 */
import { useEffect, useId, useMemo, useRef } from 'react';
import type { JSX } from 'react';

import { startMenuEntries } from './launcherEntries';
import { paneMenuEntries } from './paneMenu';
import styles from './StartMenu.module.css';
import { useAvailableRegistry } from './useAvailableRegistry';
import { useStartDismiss } from './useStartDismiss';
import { ViewList } from './ViewList';
import { useAppDispatch, useAppState } from '../state/StateContext';
import type { PostActionLine } from '../ui/postActionTypes';
import { usePostActions } from '../views/PostActionsContext';

/** The open list, id `id`: it takes focus on its first row as it opens, and a chosen row closes the menu and runs its line. */
function StartPopup(props: { readonly id: string }): JSX.Element {
  const registry = useAvailableRegistry();
  const { settings } = useAppState();
  const dispatch = useAppDispatch();
  const { run } = usePostActions();
  const popupRef = useRef<HTMLDivElement | null>(null);
  const entries = useMemo(
    () => startMenuEntries(paneMenuEntries(registry, settings.feeds)),
    [registry, settings.feeds],
  );
  useEffect(() => {
    popupRef.current?.querySelector('button')?.focus();
  }, []);
  const choose = (line: PostActionLine): void => {
    dispatch({ type: 'startMenu', open: false });
    run(line);
  };
  return (
    <div className={styles['popup']} id={props.id} ref={popupRef}>
      <ViewList command="float" entries={entries} label="Open a view as a float" run={choose} />
    </div>
  );
}

/** The start menu: its button, and its list of views while it is open. */
export function StartMenu(): JSX.Element {
  const { startMenu } = useAppState();
  const dispatch = useAppDispatch();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();
  useStartDismiss({
    open: startMenu,
    rootRef,
    buttonRef,
    close: () => {
      dispatch({ type: 'startMenu', open: false });
    },
  });
  return (
    <div className={styles['root']} ref={rootRef}>
      <button
        aria-controls={startMenu ? menuId : undefined}
        aria-expanded={startMenu}
        aria-label="[≡ wired] start menu"
        className={styles['button']}
        onClick={() => {
          dispatch({ type: 'startMenu', open: !startMenu });
        }}
        ref={buttonRef}
        type="button"
      >
        [≡ wired]
      </button>
      {startMenu ? <StartPopup id={menuId} /> : null}
    </div>
  );
}
