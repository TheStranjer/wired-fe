/**
 * The dock preview of a float dragged with Shift held (WFE-231, decisions 12
 * and 16): a dashed outline over the half of the target pane the float would
 * take, and a polite live region announcing "Dock left of #home" for screen
 * readers. The region is always rendered so a change of text is announced.
 */
import { useCallback } from 'react';
import type { JSX } from 'react';

import styles from './DockHint.module.css';
import { useT } from '../i18n/I18nProvider';
import type { DropTarget } from '../windows/dropZone';

/** The outline over the half of a pane a float would take. */
function Outline(props: { readonly zone: DropTarget['zone'] }): JSX.Element {
  const { x, y, w, h } = props.zone;
  const place = useCallback(
    (element: HTMLDivElement | null) => {
      element?.style.setProperty('--zone-x', `${String(x * 100)}%`);
      element?.style.setProperty('--zone-y', `${String(y * 100)}%`);
      element?.style.setProperty('--zone-w', `${String(w * 100)}%`);
      element?.style.setProperty('--zone-h', `${String(h * 100)}%`);
    },
    [x, y, w, h],
  );
  return <div ref={place} className={styles['zone']} aria-hidden="true" />;
}

/** The outline and the live region; `title` is the window shown by the target pane. */
export function DockHint(props: {
  readonly target: DropTarget | null;
  readonly title: string;
}): JSX.Element {
  const { target, title } = props;
  const t = useT();
  return (
    <>
      {target === null ? null : <Outline zone={target.zone} />}
      <div aria-live="polite" className={styles['announce']}>
        {target === null ? '' : t('app.dock_announce', { edge: target.edge, title })}
      </div>
    </>
  );
}
