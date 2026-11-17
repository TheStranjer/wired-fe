/**
 * Chord strings: from keyboard events, from binding text a user writes, and
 * the one rule the keymap and `/bind` share over a finished chord.
 */
import { describe, expect, it } from 'vitest';

import { blocksTyping, chordFromEvent, parseChord } from './chord';
import type { KeyLike } from './chord';

/** A keyboard event whose modifiers default to off. */
function keyEvent(key: string, held: Partial<Omit<KeyLike, 'key'>> = {}): KeyLike {
  return { key, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...held };
}

type EventCase = {
  readonly label: string;
  readonly event: KeyLike;
  readonly chord: string;
};

const EVENT_CASES: readonly EventCase[] = [
  { label: 'a plain letter', event: keyEvent('j'), chord: 'j' },
  {
    label: 'a lowercased letter with Ctrl',
    event: keyEvent('E', { ctrlKey: true }),
    chord: 'Ctrl+e',
  },
  { label: 'a digit with Alt', event: keyEvent('1', { altKey: true }), chord: 'Alt+1' },
  {
    label: 'a character that already shows Shift',
    event: keyEvent('?', { shiftKey: true }),
    chord: '?',
  },
  {
    label: 'a character with Ctrl and Shift',
    event: keyEvent('+', { ctrlKey: true, shiftKey: true }),
    chord: 'Ctrl++',
  },
  {
    label: 'an uppercase letter with Shift',
    event: keyEvent('A', { shiftKey: true }),
    chord: 'Shift+a',
  },
  {
    label: 'a named key with Shift',
    event: keyEvent('Tab', { shiftKey: true }),
    chord: 'Shift+Tab',
  },
  {
    label: 'an arrow key with Ctrl and Alt',
    event: keyEvent('ArrowUp', { altKey: true, ctrlKey: true }),
    chord: 'Ctrl+Alt+ArrowUp',
  },
  { label: 'the space bar', event: keyEvent(' '), chord: 'Space' },
  {
    label: 'the space bar with Shift and Meta',
    event: keyEvent(' ', { metaKey: true, shiftKey: true }),
    chord: 'Shift+Meta+Space',
  },
  { label: 'a function key', event: keyEvent('F12'), chord: 'F12' },
  { label: 'the plus key', event: keyEvent('+'), chord: '+' },
];

const UNBOUNDABLE_EVENTS: readonly { readonly label: string; readonly key: string }[] = [
  { label: 'a bare Shift', key: 'Shift' },
  { label: 'a bare Control', key: 'Control' },
  { label: 'a bare Alt', key: 'Alt' },
  { label: 'a bare Meta', key: 'Meta' },
  { label: 'AltGraph', key: 'AltGraph' },
  { label: 'CapsLock', key: 'CapsLock' },
  { label: 'a dead key', key: 'Dead' },
  { label: 'an unidentified key', key: 'Unidentified' },
  { label: 'a media key', key: 'MediaPlayPause' },
  { label: 'a name no keyboard sends', key: 'Copy' },
  { label: 'a control character', key: '\u0007' },
];

type ChordCase = {
  readonly label: string;
  readonly text: string;
  readonly chord: string;
};

const BINDING_CASES: readonly ChordCase[] = [
  { label: 'a lowercase binding', text: 'ctrl+e', chord: 'Ctrl+e' },
  { label: 'spaces around the parts', text: ' Alt + 1 ', chord: 'Alt+1' },
  { label: 'a named key in lowercase', text: 'shift+tab', chord: 'Shift+Tab' },
  { label: 'an uppercase named key', text: 'ESCAPE', chord: 'Escape' },
  { label: 'the space bar by name', text: 'space', chord: 'Space' },
  { label: 'cmd as Meta', text: 'cmd+k', chord: 'Meta+k' },
  { label: 'super as Meta', text: 'super+shift+enter', chord: 'Shift+Meta+Enter' },
  { label: 'option as Alt', text: 'option+1', chord: 'Alt+1' },
  { label: 'control as Ctrl', text: 'Control+F12', chord: 'Ctrl+F12' },
  { label: 'an uppercase letter after Shift', text: 'shift+A', chord: 'Shift+a' },
  { label: 'Shift before a character', text: 'shift+?', chord: '?' },
  { label: 'a trailing + as the plus key', text: 'ctrl++', chord: 'Ctrl++' },
  { label: 'the plus key alone', text: '+', chord: '+' },
  { label: 'a bare character', text: '?', chord: '?' },
  {
    label: 'modifiers out of order',
    text: 'meta+alt+shift+ctrl+s',
    chord: 'Ctrl+Alt+Shift+Meta+s',
  },
];

const UNBINDABLE_TEXTS: readonly { readonly label: string; readonly text: string }[] = [
  { label: 'empty text', text: '' },
  { label: 'text with no key', text: 'ctrl+' },
  { label: 'a repeated modifier', text: 'ctrl+ctrl+e' },
  { label: 'an unknown key name', text: 'ctrl+nope' },
  { label: 'an unknown modifier', text: 'hyper+k' },
  { label: 'modifiers without a key', text: 'ctrl+shift' },
  { label: 'two characters', text: 'ctrl+ab' },
  { label: 'a blank key', text: 'ctrl+ ' },
  { label: 'only separators', text: '++' },
];

describe(chordFromEvent, () => {
  it.each(EVENT_CASES)('reads $label', ({ event, chord }) => {
    expect(chordFromEvent(event)).toBe(chord);
  });

  it.each(UNBOUNDABLE_EVENTS)('refuses $label', ({ key }) => {
    expect(chordFromEvent(keyEvent(key))).toBeNull();
  });
});

describe(parseChord, () => {
  it.each(BINDING_CASES)('reads $label', ({ text, chord }) => {
    expect(parseChord(text)).toBe(chord);
  });

  it.each(UNBINDABLE_TEXTS)('refuses $label', ({ text }) => {
    expect(parseChord(text)).toBeNull();
  });

  it('refuses text that is only spaces', () => {
    expect(parseChord('   ')).toBeNull();
  });

  it.each(EVENT_CASES)('parses the chord written for $label', ({ chord }) => {
    expect(parseChord(chord)).toBe(chord);
  });
});

describe(blocksTyping, () => {
  it.each(['a', 'k', '?', '+', 'Shift+a', 'Shift+/'])('blocks typing for %s', (chord) => {
    expect(blocksTyping(chord)).toBe(true);
  });

  it.each(['Alt+3', 'Ctrl+e', 'Meta+k', 'Shift+F1', 'Space', 'Enter', 'PageUp', 'F12'])(
    'leaves typing alone for %s',
    (chord) => {
      expect(blocksTyping(chord)).toBe(false);
    },
  );
});
