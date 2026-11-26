/**
 * The tray directly above the command line (WFE-287): while media wait for the
 * next post, one row per file with its thumbnail, name, upload state, alt-text
 * input and `[x]` — the composer's own lines (src/views/AttachmentList) over
 * the command line's slice of the composers' media. A labelled list, `Pending
 * media`, with a height of its own that scrolls inside, so it never pushes the
 * desktop. Nothing shows while nothing waits.
 */
import type { JSX } from 'react';

import styles from './CommandTray.module.css';
import { PENDING_MEDIA_LABEL } from './trayFocus';
import type { Attachments } from './useAttachments';
import { AttachmentList } from '../views/AttachmentList';

/** The pending media the tray shows. */
export type CommandTrayProps = {
  readonly attachments: Pick<Attachments, 'items' | 'describe' | 'remove'>;
};

/** The pending media as rows above the command line; nothing while none wait. */
export function CommandTray(props: CommandTrayProps): JSX.Element | null {
  const { attachments } = props;
  if (attachments.items.length === 0) {
    return null;
  }
  return (
    <div className={styles['tray']}>
      <AttachmentList
        items={attachments.items}
        label={PENDING_MEDIA_LABEL}
        onDescribe={attachments.describe}
        onRemove={attachments.remove}
      />
    </div>
  );
}
