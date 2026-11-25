/** Tests for choosing the base commit, with git replaced by a table of answers. */
import { describe, expect, it } from 'vitest';

import { type Git, resolveBase } from './base';

/** A git double answering from a table keyed by the space-joined arguments. */
function fakeGit(answers: Readonly<Record<string, string>>): Git {
  return (args) => answers[args.join(' ')];
}

const HEAD = { 'rev-parse HEAD': 'headsha\n' };

describe(resolveBase, () => {
  it('uses COVERAGE_BASE, resolved to a commit', () => {
    const git = fakeGit({ ...HEAD, 'rev-parse --verify --quiet abc^{commit}': 'fullsha\n' });

    expect(resolveBase({ COVERAGE_BASE: 'abc' }, git)).toBe('fullsha');
  });

  it('prefers COVERAGE_BASE over the merge base', () => {
    const git = fakeGit({
      ...HEAD,
      'rev-parse --verify --quiet abc^{commit}': 'fullsha',
      'merge-base HEAD master': 'mergesha',
    });

    expect(resolveBase({ COVERAGE_BASE: 'abc' }, git)).toBe('fullsha');
  });

  it('refuses a COVERAGE_BASE that is not a commit', () => {
    expect(() => resolveBase({ COVERAGE_BASE: 'nope' }, fakeGit(HEAD))).toThrow(
      'COVERAGE_BASE=nope is not a commit',
    );
  });

  it('ignores an empty COVERAGE_BASE and takes the merge base with master', () => {
    const git = fakeGit({ ...HEAD, 'merge-base HEAD master': 'mergesha\n' });

    expect(resolveBase({ COVERAGE_BASE: '' }, git)).toBe('mergesha');
  });

  it('falls back to the merge base with origin/master', () => {
    const git = fakeGit({ ...HEAD, 'merge-base HEAD origin/master': 'originsha' });

    expect(resolveBase({}, git)).toBe('originsha');
  });

  it('prefers master over origin/master', () => {
    const git = fakeGit({
      ...HEAD,
      'merge-base HEAD master': 'localsha',
      'merge-base HEAD origin/master': 'originsha',
    });

    expect(resolveBase({}, git)).toBe('localsha');
  });

  it('has no base when neither master resolves', () => {
    expect(resolveBase({}, fakeGit(HEAD))).toBeUndefined();
  });

  it('treats blank git output as no answer', () => {
    expect(resolveBase({}, fakeGit({ ...HEAD, 'merge-base HEAD master': '\n' }))).toBeUndefined();
  });

  it('has no base when HEAD is the base, as on master itself', () => {
    const git = fakeGit({ ...HEAD, 'merge-base HEAD master': 'headsha' });

    expect(resolveBase({}, git)).toBeUndefined();
  });

  it('has no base when COVERAGE_BASE is HEAD', () => {
    const git = fakeGit({ ...HEAD, 'rev-parse --verify --quiet HEAD^{commit}': 'headsha' });

    expect(resolveBase({ COVERAGE_BASE: 'HEAD' }, git)).toBeUndefined();
  });
});
