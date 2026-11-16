/**
 * Tests for collecting self-registered window kind definitions out of globbed
 * feature modules, and for loading the features folder.
 */
import { describe, expect, it } from 'vitest';

import { collectWindowKinds, loadWindowKinds } from './windowKinds';
import { err, ok } from '../lib/result';
import type { PostContext, WindowKindDefinition } from '../state/windowKind';

/** A component stand-in: the collector only checks that it is a function. */
function StubWindow(): null {
  return null;
}

const home: WindowKindDefinition = {
  kind: 'home',
  topic: () => 'home',
  Component: StubWindow,
};

const thread: WindowKindDefinition = {
  kind: 'thread',
  topic: () => 'thread',
  Component: StubWindow,
  onPost: async (_draft, _window, context: PostContext) =>
    await Promise.resolve(context.state.mode === 'navigation' ? 'type first' : null),
};

/** The kinds loadWindowKinds collected, throwing when loading failed. */
function loaded(): ReadonlyMap<string, WindowKindDefinition> {
  const result = loadWindowKinds();
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

describe(collectWindowKinds, () => {
  it('collects no kinds from no modules', () => {
    expect(collectWindowKinds({})).toStrictEqual(ok(new Map()));
  });

  it('collects the windowKind export of every module, ordered by path', () => {
    const modules = {
      '../features/thread/windowKind.tsx': { windowKind: thread },
      '../features/home/windowKind.tsx': { windowKind: home },
    };

    expect(collectWindowKinds(modules)).toStrictEqual(
      ok(
        new Map([
          ['home', home],
          ['thread', thread],
        ]),
      ),
    );
  });

  it('names the path of a module without a windowKind export', () => {
    expect(
      collectWindowKinds({ '../features/x/windowKind.tsx': { notWindowKind: 1 } }),
    ).toStrictEqual(err('../features/x/windowKind.tsx does not export a windowKind'));
  });

  it('rejects modules that are not objects', () => {
    const rejected = err('./f.tsx does not export a windowKind');

    expect(collectWindowKinds({ './f.tsx': undefined })).toStrictEqual(rejected);
    expect(collectWindowKinds({ './f.tsx': null })).toStrictEqual(rejected);
    expect(collectWindowKinds({ './f.tsx': 42 })).toStrictEqual(rejected);
    expect(collectWindowKinds({ './f.tsx': 'text' })).toStrictEqual(rejected);
  });

  it('rejects windowKind exports that are not objects', () => {
    const rejected = err('./f.tsx does not export a windowKind');

    expect(collectWindowKinds({ './f.tsx': { windowKind: undefined } })).toStrictEqual(rejected);
    expect(collectWindowKinds({ './f.tsx': { windowKind: null } })).toStrictEqual(rejected);
    expect(collectWindowKinds({ './f.tsx': { windowKind: 42 } })).toStrictEqual(rejected);
    expect(collectWindowKinds({ './f.tsx': { windowKind: 'text' } })).toStrictEqual(rejected);
    expect(collectWindowKinds({ './f.tsx': { windowKind: () => undefined } })).toStrictEqual(
      rejected,
    );
  });

  it('requires a string kind and a function Component', () => {
    const rejected = err('./f.tsx does not export a windowKind');

    expect(
      collectWindowKinds({ './f.tsx': { windowKind: { kind: 7, Component: StubWindow } } }),
    ).toStrictEqual(rejected);
    expect(collectWindowKinds({ './f.tsx': { windowKind: { kind: 'home' } } })).toStrictEqual(
      rejected,
    );
    expect(
      collectWindowKinds({ './f.tsx': { windowKind: { kind: 'home', Component: 'no' } } }),
    ).toStrictEqual(rejected);
  });

  it('rejects two modules exporting the same kind', () => {
    const modules = {
      '../features/b/windowKind.tsx': { windowKind: home },
      '../features/a/windowKind.tsx': { windowKind: { ...home, topic: () => 'other' } },
    };

    expect(collectWindowKinds(modules)).toStrictEqual(
      err(
        'window kind home is exported by ../features/a/windowKind.tsx ' +
          'and ../features/b/windowKind.tsx',
      ),
    );
  });

  it('stops at the first bad path when several modules are given', () => {
    const modules = {
      './b.tsx': {},
      './a.tsx': { windowKind: 'nope' },
    };

    expect(collectWindowKinds(modules)).toStrictEqual(err('./a.tsx does not export a windowKind'));
  });
});

describe(loadWindowKinds, () => {
  it('returns the kinds collected from the features folder as a map', () => {
    expect(loaded()).toStrictEqual(expect.any(Map));
  });

  it('includes the status kind window 1 opens with', () => {
    expect([...loaded().keys()]).toContain('status');
  });

  it('includes the home kind /home opens a window with', () => {
    expect([...loaded().keys()]).toContain('home');
  });

  it('includes the local and federated kinds /local and /federated open windows with', () => {
    const keys = [...loaded().keys()];

    expect(keys).toContain('local');
    expect(keys).toContain('federated');
  });

  it('includes the notifications kind /notifications opens a window with', () => {
    expect([...loaded().keys()]).toContain('notifications');
  });

  it('includes the hashtag kind /tag opens a window with', () => {
    expect([...loaded().keys()]).toContain('hashtag');
  });

  it('includes the thread kind /thread opens a window with', () => {
    expect([...loaded().keys()]).toContain('thread');
  });
});
