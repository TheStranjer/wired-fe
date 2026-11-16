/**
 * The `profile` window kind (AGENTS.md "Windows, like IRC buffers", WFE-106):
 * one account, seen as the window's own account sees it — the whois block
 * (src/ui/WhoisBlock) above the scrollback of the account's posts, paged from
 * the account statuses endpoint through the shared loader
 * (src/views/TimelineWindow). The block's data arrives from ./useProfile; the
 * log region and the topic line name the account `@<acct>`, the way the
 * window was opened (src/state/profileWindow, src/commands/defs/whois).
 * Nothing is posted into somebody's profile: the definition carries no
 * `onPost`, the way the notifications window does.
 */

import type { JSX } from 'react';

import { useProfile } from './useProfile';
import { accountStatuses } from '../../api/endpoints/accountRead';
import { useAppState } from '../../state/StateContext';
import type { WindowKindDefinition } from '../../state/windowKind';
import { WhoisBlock } from '../../ui/WhoisBlock';
import { TimelineWindow } from '../../views/TimelineWindow';
import type { FetchPage } from '../../views/useTimeline';

/** The profile window: its account's whois block above its post timeline. */
function ProfileWindow({ windowId }: { readonly windowId: string }): JSX.Element {
  const state = useAppState();
  const win = state.windows.windows.find((candidate) => candidate.id === windowId);
  const target = win?.ref.target ?? '';
  const whois = useProfile(windowId);
  const fetchPage: FetchPage = async (session, page, signal) =>
    await accountStatuses(session, target, page === undefined ? {} : { page }, signal);
  return (
    <>
      {whois === null ? undefined : <WhoisBlock {...whois} />}
      <TimelineWindow fetchPage={fetchPage} label={win?.title ?? 'profile'} windowId={windowId} />
    </>
  );
}

/** The self-registered definition src/app/windowKinds.ts collects. */
export const windowKind: WindowKindDefinition = {
  kind: 'profile',
  topic: (window) => window.title,
  Component: ProfileWindow,
};
