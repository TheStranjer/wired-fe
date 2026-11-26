/**
 * Tests that notification lines follow the language (decision 19, WFE-321):
 * the `***` sentence of the IRC rendering and the verb of the card rendering
 * read the fake language, with the absent parts of a sentence (no label, no
 * target) leaving no gap, and the quoted excerpt of a post with no words says
 * so in it.
 */
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NotificationLine } from './NotificationLine';
import { DEFAULT_SETTINGS } from '../state/settings';
import { status } from '../test/fixtures';
import { installFakeLocale } from '../test/i18n';
import { lineText, note, renderLine, seeded } from '../test/notificationCards';

/** The IRC rendering's settings. */
const LINES = { ...DEFAULT_SETTINGS, density: 'lines' } as const;

/** A language that words every notification differently. */
const FAKE = {
  views: {
    excerpt: { no_text: 'EMPTY' },
    notification: {
      favourite: '{actor} LIKED {label} {excerpt}',
      report: '{actor} REPORT{target, select, none {} other { ABOUT {target}}} {comment}',
    },
    notification_card: { favourite: 'LIKED YOURS', poll: 'POLL OVER' },
  },
};

describe('notification lines in another language', () => {
  it('words an IRC sentence in it', () => {
    installFakeLocale(FAKE);
    const { container } = renderLine(
      NotificationLine,
      seeded(note('favourite', status('q', { content: '<p>hi</p>' })), LINES),
    );

    expect(lineText(container)).toContain('@lain@wired.example LIKED');
    expect(lineText(container)).toContain('"hi"');
  });

  it('drops the target clause where a report names no target', () => {
    installFakeLocale(FAKE);
    const { container } = renderLine(NotificationLine, seeded(note('admin.report', null), LINES));

    expect(lineText(container)).toContain('@lain@wired.example REPORT');
    expect(lineText(container)).not.toContain('ABOUT');
  });

  it('words the verb of a card in it', () => {
    installFakeLocale(FAKE);
    renderLine(NotificationLine, seeded(note('favourite', status('q'))));

    expect(screen.getByText(/LIKED YOURS/u)).toBeVisible();
  });

  it('words the poll card in it', () => {
    installFakeLocale(FAKE);
    renderLine(NotificationLine, seeded(note('poll', status('q'))));

    expect(screen.getByText(/POLL OVER/u)).toBeVisible();
  });

  it('says in it that a quoting post has no words', () => {
    installFakeLocale(FAKE);
    const { container } = renderLine(
      NotificationLine,
      seeded(note('quote', status('q', { content: '' })), LINES),
    );

    expect(lineText(container)).toContain('EMPTY');
  });
});
