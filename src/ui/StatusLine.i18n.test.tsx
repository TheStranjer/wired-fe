/**
 * Tests that the status line takes its accessible names and tooltips from the
 * language in use (decision 19): in a fake language every entry reads the
 * fake catalog, with the state words inside the one message.
 */
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { StatusLine } from './StatusLine';
import { I18nProvider } from '../i18n/I18nProvider';
import { installFakeLocale, resetFakeLocale } from '../test/i18n';

const NOOP = (): undefined => undefined;

/** Switch to the fake language and show a status line with every group. */
function renderFake(): void {
  installFakeLocale({
    ui: {
      status_line: {
        close_desktop: 'XX close {number}',
        desktop:
          'XX desktop {number}{active, select, true {, on} other {}}{unread, plural, =0 {} other {, {unread} new}}{highlight, select, true {, hot} other {}}',
        desktop_title: 'XX switch {number}',
        media_waiting: 'XX media {count}',
        no_posting_account: 'XX nobody',
        posting_as: 'XX as {label}',
        sync_pending: 'XX syncing',
        window:
          'XX window {number} {title}{unread, plural, =0 {} other {, {unread} new}}{highlight, select, true {, hot} other {}}',
      },
    },
  });
  render(
    <I18nProvider>
      <StatusLine
        accountLabel="@lain@wired.example"
        clock="23:07"
        desktops={[
          { number: 1, unread: 0, highlight: false, active: false },
          { number: 2, unread: 12, highlight: true, active: true },
        ]}
        mode="insert"
        onCloseDesktop={NOOP}
        onSelectDesktop={NOOP}
        onSelectWindow={NOOP}
        onShowMedia={NOOP}
        pendingKeys={null}
        pendingMedia={2}
        postingAs={{ label: '@lain@wired.example', onPick: NOOP }}
        sync="pending"
        windows={[{ number: 7, title: 'dm/bob', unread: 2, highlight: true }]}
      />
    </I18nProvider>,
  );
}

describe(StatusLine, () => {
  afterEach(resetFakeLocale);

  it('names desktops and windows in the language in use', () => {
    renderFake();

    expect(screen.getByRole('button', { name: 'XX desktop 1' })).toHaveAttribute(
      'title',
      'XX switch 1',
    );
    expect(screen.getByRole('button', { name: 'XX desktop 2, on, 12 new, hot' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'XX close 2' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'XX window 7 dm/bob, 2 new, hot' })).toBeVisible();
  });

  it('names the media, posting and sync groups in the language in use', () => {
    renderFake();

    expect(screen.getByRole('button', { name: 'XX media 2' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'XX as @lain@wired.example' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'XX syncing' })).toBeVisible();
  });

  it('names a missing posting account in the language in use', () => {
    installFakeLocale({ ui: { status_line: { no_posting_account: 'XX nobody' } } });
    render(
      <I18nProvider>
        <StatusLine
          accountLabel={null}
          clock="23:07"
          desktops={[]}
          mode="insert"
          onCloseDesktop={NOOP}
          onSelectDesktop={NOOP}
          onSelectWindow={NOOP}
          onShowMedia={NOOP}
          pendingKeys={null}
          postingAs={{ label: '?', onPick: NOOP }}
          windows={[]}
        />
      </I18nProvider>,
    );

    expect(screen.getByRole('button', { name: 'XX nobody' })).toBeVisible();
  });
});
