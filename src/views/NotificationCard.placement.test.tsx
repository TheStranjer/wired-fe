/**
 * Tests for placing the windows a notification's clicks open (WFE-238,
 * decision 13): the actor's handle and the excerpt open their profile and
 * thread windows where the click's modifiers say, and in the focused pane on
 * a plain click.
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NotificationLine } from './NotificationLine';
import { DEFAULT_SETTINGS } from '../state/settings';
import { status } from '../test/fixtures';
import { note, renderLine, seeded } from '../test/notificationCards';
import { PLACEMENT_PROBE } from '../test/placementProbe';

const ACTOR = '@lain@wired.example';

/** What the probe says about where the windows are. */
function placed(): HTMLElement {
  return screen.getByRole('region', { name: PLACEMENT_PROBE });
}

/** Dispatch the middle button's auxiliary click on {@link element}. */
function middleClick(element: HTMLElement): void {
  fireEvent(element, new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }));
}

describe('the placement of a notification actor click', () => {
  it('opens the profile in the focused pane on a plain click', () => {
    renderLine(NotificationLine, seeded(note('follow', null)));

    fireEvent.click(screen.getByRole('button', { name: ACTOR }));

    expect(placed()).toHaveTextContent(`panes: ${ACTOR} | floats: -`);
  });

  it.each([
    [{ shiftKey: true }, `panes: notifications, ${ACTOR} | floats: -`],
    [{ ctrlKey: true }, `panes: notifications | floats: ${ACTOR}`],
  ])('places a click with %j', (init, expected) => {
    renderLine(NotificationLine, seeded(note('follow', null)));

    fireEvent.click(screen.getByRole('button', { name: ACTOR }), init);

    expect(placed()).toHaveTextContent(expected);
  });

  it('opens the profile hidden on a middle click', () => {
    renderLine(NotificationLine, seeded(note('follow', null)));

    middleClick(screen.getByRole('button', { name: ACTOR }));

    expect(placed()).toHaveTextContent('panes: notifications | floats: -');
  });

  it('follows the per-kind setting on a plain click', () => {
    const settings = { ...DEFAULT_SETTINGS, openInByKind: { profile: 'float' } } as const;
    renderLine(NotificationLine, seeded(note('follow', null), settings));

    fireEvent.click(screen.getByRole('button', { name: ACTOR }));

    expect(placed()).toHaveTextContent(`panes: notifications | floats: ${ACTOR}`);
  });
});

describe('the placement of a notification excerpt click', () => {
  const EXCERPT = '"look"';
  const post = status('q', { content: '<p>look</p>' });

  it('opens the thread in the focused pane on a plain click', () => {
    renderLine(NotificationLine, seeded(note('favourite', post)));

    fireEvent.click(screen.getByRole('button', { name: EXCERPT }));

    expect(placed()).toHaveTextContent('panes: thread/a0 | floats: -');
  });

  it.each([
    [{ shiftKey: true }, 'panes: notifications, thread/a0 | floats: -'],
    [{ metaKey: true }, 'panes: notifications | floats: thread/a0'],
  ])('places a click with %j', (init, expected) => {
    renderLine(NotificationLine, seeded(note('favourite', post)));

    fireEvent.click(screen.getByRole('button', { name: EXCERPT }), init);

    expect(placed()).toHaveTextContent(expected);
  });

  it('opens the thread hidden on a middle click', () => {
    renderLine(NotificationLine, seeded(note('favourite', post)));

    middleClick(screen.getByRole('button', { name: EXCERPT }));

    expect(placed()).toHaveTextContent('panes: notifications | floats: -');
  });
});
