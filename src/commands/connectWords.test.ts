/**
 * Tests for the completion of the instance after `/connect` (WFE-307): a
 * `list` build offers its hosts, and no other build offers anything.
 */
import { describe, expect, it } from 'vitest';

import { candidatesAt, startCompletion } from './complete';
import { connectProvider } from './connectWords';
import { suggestionView } from './suggest';
import type { InstancesConfig } from '../config/schema';

const LIST: InstancesConfig = {
  mode: 'list',
  origins: ['https://wired.example', 'https://pleroma.example:8443', 'http://localhost:3000'],
};

/** Every candidate Tab would cycle through for {@link text} on {@link instances}. */
function candidates(instances: InstancesConfig, text: string): readonly string[] {
  return candidatesAt(text, text.length, [connectProvider(instances)])?.candidates ?? [];
}

describe(connectProvider, () => {
  it('completes a typed prefix to the listed host', () => {
    const done = startCompletion('/connect w', 10, [connectProvider(LIST)]);

    expect(done?.text).toBe('/connect wired.example ');
  });

  it('answers to the aliases of the command in any case', () => {
    expect(candidates(LIST, '/login p')).toStrictEqual(['pleroma.example:8443']);
    expect(candidates(LIST, '/SERVER W')).toStrictEqual(['wired.example']);
  });

  it('offers every instance after the bare command and a space, sorted', () => {
    expect(candidates(LIST, '/connect ')).toStrictEqual([
      'http://localhost:3000',
      'pleroma.example:8443',
      'wired.example',
    ]);
  });

  it('also matches what was typed as a whole origin', () => {
    expect(candidates(LIST, '/connect https://wi')).toStrictEqual(['wired.example']);
  });

  it('offers nothing after the first argument, after another command or for the command itself', () => {
    expect(candidates(LIST, '/connect wired.example x')).toStrictEqual([]);
    expect(candidates(LIST, '/win w')).toStrictEqual([]);
    expect(candidates(LIST, '/connect')).toStrictEqual([]);
  });

  it('offers nothing on a build with nothing to choose from', () => {
    expect(candidates({ mode: 'open' }, '/connect w')).toStrictEqual([]);
    expect(candidates({ mode: 'same-origin' }, '/connect w')).toStrictEqual([]);
    expect(
      candidates({ mode: 'list', origins: [], allowCustom: true }, '/connect w'),
    ).toStrictEqual([]);
  });

  it('lists the hosts as rows that complete when clicked, each with its origin', () => {
    const view = suggestionView({ text: '/connect w', cursor: 10 }, [connectProvider(LIST)], null);

    expect(view?.rows).toStrictEqual([
      {
        word: 'wired.example',
        label: 'wired.example',
        description: 'https://wired.example',
        words: ['wired.example'],
      },
    ]);
    expect(view?.pick('wired.example').text).toBe('/connect wired.example ');
  });

  it('describes a word it does not list with no description', () => {
    expect(connectProvider(LIST).describe?.('other.example')?.description).toBe('');
  });

  it('declines when the engine passes no line', () => {
    expect(connectProvider(LIST).accepts('w', false)).toBe(false);
  });
});
