/**
 * The split tree types and lookups: single panes, finding, listing, setting
 * a pane's window and reducing to one pane.
 */
import { describe, expect, it } from 'vitest';

import { findPane, panes, panesShowing, setPaneWindow, singlePane } from './splitTree';
import { nestedTree, shape } from './splitTreeFixtures';

describe(singlePane, () => {
  it('is one pane showing the window', () => {
    expect(singlePane('p1', 'w1')).toStrictEqual({ type: 'pane', paneId: 'p1', windowId: 'w1' });
  });
});

describe(findPane, () => {
  it('finds the root pane of a single-pane tree', () => {
    expect(findPane(singlePane('p1', 'w1'), 'p1')?.windowId).toBe('w1');
  });

  it('finds a pane in either half, at any depth', () => {
    const tree = nestedTree();

    expect(findPane(tree, 'p1')?.windowId).toBe('w1');
    expect(findPane(tree, 'p3')?.windowId).toBe('w3');
    expect(findPane(tree, 'p4')?.windowId).toBe('w4');
  });

  it('is null for an unknown id', () => {
    expect(findPane(singlePane('p1', 'w1'), 'nope')).toBeNull();
    expect(findPane(nestedTree(), 'nope')).toBeNull();
  });
});

describe(panes, () => {
  it('lists one pane for a single-pane tree', () => {
    expect(panes(singlePane('p1', 'w1')).map((pane) => pane.paneId)).toStrictEqual(['p1']);
  });

  it('lists panes left to right and top to bottom', () => {
    expect(panes(nestedTree()).map((pane) => pane.paneId)).toStrictEqual(['p1', 'p2', 'p3', 'p4']);
  });
});

describe(panesShowing, () => {
  it('lists every pane showing the window, in tree order', () => {
    const tree = setPaneWindow(setPaneWindow(nestedTree(), 'p1', 'w9'), 'p4', 'w9');

    expect(panesShowing(tree, 'w9').map((pane) => pane.paneId)).toStrictEqual(['p1', 'p4']);
  });

  it('is empty for a window no pane shows', () => {
    expect(panesShowing(nestedTree(), 'w9')).toStrictEqual([]);
  });
});

describe(setPaneWindow, () => {
  it('shows another window in a single pane', () => {
    expect(shape(setPaneWindow(singlePane('p1', 'w1'), 'p1', 'w2'))).toBe('p1:w2');
  });

  it('changes only the named pane, at any depth', () => {
    expect(shape(setPaneWindow(nestedTree(), 'p3', 'w9'))).toBe(
      'row(p1:w1 col(p2:w2 row(p3:w9 p4:w4)))',
    );
    expect(shape(setPaneWindow(nestedTree(), 'p1', 'w9'))).toBe(
      'row(p1:w9 col(p2:w2 row(p3:w3 p4:w4)))',
    );
  });

  it('returns the same tree for an unknown pane or an unchanged window', () => {
    const tree = nestedTree();

    expect(setPaneWindow(tree, 'nope', 'w9')).toBe(tree);
    expect(setPaneWindow(tree, 'p2', 'w2')).toBe(tree);
  });

  it('does not change the input', () => {
    const tree = nestedTree();
    setPaneWindow(tree, 'p3', 'w9');

    expect(shape(tree)).toBe('row(p1:w1 col(p2:w2 row(p3:w3 p4:w4)))');
  });
});
