/**
 * Tests for the feed editor window kind's definition (decision 13): the kind it
 * self-registers, a topic that is the window's title, and no posting into it.
 */
import { describe, expect, it } from 'vitest';

import { MAIN, editorSession } from './editorSession';
import { windowKind } from './windowKind';
import { activeWindow } from '../../windows/model';

describe('the feed editor window kind', () => {
  it('is the definition for the feedEditor kind, and it takes no posts', () => {
    expect(windowKind.kind).toBe('feedEditor');
    expect(windowKind.Component).toBeTypeOf('function');
    expect(windowKind.onPost).toBeUndefined();
  });

  it('topics its window with its title', () => {
    const state = editorSession(MAIN);

    expect(windowKind.topic(activeWindow(state.windows), state)).toBe('edit ~main');
  });
});
