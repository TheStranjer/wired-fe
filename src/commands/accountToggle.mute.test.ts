/**
 * Tests for /mute's side of the shared account-toggle body, over the MSW
 * server: the duration words `30m`, `2h` and `7d` counted out into seconds
 * sent with the mute and echoed in the printed line, a bare mute going out
 * forever, the selection standing as the target under a trailing duration,
 * and the parser refusing every word that spells no duration — before
 * anything is sent.
 */
import { describe, expect, it } from 'vitest';

import { accountToggleRun, parseMuteDuration } from './accountToggle';
import { status } from '../test/fixtures';
import { FOREIGN_WIRE, homeContext, serveAccountActions } from '../test/homeWindow';

/** Somebody else's post: its author is the account the mute acts on. */
const FOREIGN = status('q', { account: FOREIGN_WIRE });

/** The relationship an instance answers a mute with. */
const MUTED = { id: '2', muting: true };

/** The handle printing ends every line with. */
const SMILING = '@smiling@wired.example';

/** The mute durations: the word typed, the seconds sent, the word echoed. */
const DURATIONS: readonly (readonly [string, number])[] = [
  ['30m', 1800],
  ['2h', 7200],
  ['7d', 604800],
];

describe('the /mute duration', () => {
  it.each(DURATIONS)('is sent as seconds and echoed under %s', async (word, seconds) => {
    const calls = serveAccountActions(MUTED);
    const context = homeContext([FOREIGN]);

    const outcome = await accountToggleRun('mute', 'muted')(`a0 ${word}`, context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(calls).toStrictEqual([{ path: '/api/v1/accounts/2/mute', body: { duration: seconds } }]);
    expect(context.print).toHaveBeenCalledWith(`muted ${SMILING} for ${word}`);
  });

  it('goes out bare without one, muting forever', async () => {
    const calls = serveAccountActions(MUTED);
    const context = homeContext([FOREIGN]);

    const outcome = await accountToggleRun('mute', 'muted')('a0', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(calls).toStrictEqual([{ path: '/api/v1/accounts/2/mute', body: undefined }]);
    expect(context.print).toHaveBeenCalledWith(`muted ${SMILING}`);
  });

  it('rides with the standing selection, which names the target', async () => {
    serveAccountActions(MUTED);
    const context = homeContext([FOREIGN], 'q');

    const outcome = await accountToggleRun('mute', 'muted')('30m', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.print).toHaveBeenCalledWith(`muted ${SMILING} for 30m`);
  });

  it.each([
    ['soon', 'soon'],
    ['30x', '30x'],
    ['30x junk', '30x'],
    ['30', '30'],
  ] as const)('refuses %s before sending', async (typed, quoted) => {
    const calls = serveAccountActions(MUTED);
    const context = homeContext([FOREIGN]);

    const outcome = await accountToggleRun('mute', 'muted')(`a0 ${typed}`, context);

    expect(outcome).toStrictEqual({ ok: false, message: `Bad duration: ${quoted}` });
    expect(calls).toStrictEqual([]);
    expect(context.print).not.toHaveBeenCalled();
  });
});

describe(parseMuteDuration, () => {
  it.each(['', '   '])('reads %j as forever', (text) => {
    expect(parseMuteDuration(text)).toStrictEqual({ ok: true, value: null });
  });

  it.each(DURATIONS)('counts %s out as %i seconds, keeping the word', (word, seconds) => {
    expect(parseMuteDuration(`  ${word} extra `)).toStrictEqual({
      ok: true,
      value: [seconds, word],
    });
  });

  it.each([
    ['', null],
    ['   ', null],
    ['0m', [0, '0m']],
  ] as const)('reads %j as %j', (text, value) => {
    expect(parseMuteDuration(text)).toStrictEqual({ ok: true, value });
  });

  it.each(['soon', 'h', '30', '-5m', '30mh', '30 min'])('refuses %s', (text) => {
    expect(parseMuteDuration(text)).toStrictEqual({
      ok: false,
      error: `Bad duration: ${text.split(' ')[0] ?? ''}`,
    });
  });
});
