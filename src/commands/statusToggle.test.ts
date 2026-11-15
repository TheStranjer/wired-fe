/**
 * Tests for the toggle body the eight post commands share, over the MSW
 * server: every flag put on and taken back under the label of the line the
 * window shows, the `un…` commands undoing whether or not the post carried the
 * flag, the original inside a boost's wrapper answer reaching the scrollbacks,
 * both pin commands refusing a post of somebody else's without sending, an
 * instance turning a call down reported as the API error it is, and the target
 * resolver's refusals coming back instead of a request.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { type ToggleCommand, runStatusToggle } from './statusToggle';
import { status } from '../test/fixtures';
import { FOREIGN_WIRE, ORIGIN, homeContext, serveStatusActions } from '../test/homeWindow';
import { server } from '../test/server';

/** lain's post, every flag off: the fixture's own author is lain. */
const POST = status('p');

/** A boost line showing {@link POST}; its own label is the one printed. */
const BOOST = status('b', { reblog: POST });

/** A post of somebody else's, which no pin command may touch. */
const FOREIGN = status('q', { account: FOREIGN_WIRE });

/**
 * The four features: the command that moves the flag, the flag itself, the two
 * endpoints it posts to, and the mark and verb the window prints.
 */
const FEATURES = [
  {
    command: 'fav',
    flag: 'favourited',
    on: 'favourite',
    off: 'unfavourite',
    mark: '★',
    verb: 'favourited',
  },
  {
    command: 'boost',
    flag: 'reblogged',
    on: 'reblog',
    off: 'unreblog',
    mark: '⟳',
    verb: 'boosted',
  },
  {
    command: 'bookmark',
    flag: 'bookmarked',
    on: 'bookmark',
    off: 'unbookmark',
    mark: '🔖',
    verb: 'bookmarked',
  },
  { command: 'pin', flag: 'pinned', on: 'pin', off: 'unpin', mark: '📌', verb: 'pinned' },
] as const;

/** The four undo commands: the path they always send and what they print. */
const UNDOS: readonly (readonly [ToggleCommand, string, string])[] = [
  ['unfav', 'unfavourite', '★ unfavourited'],
  ['unboost', 'unreblog', '⟳ unboosted'],
  ['unbookmark', 'unbookmark', '🔖 unbookmarked'],
  ['unpin', 'unpin', '📌 unpinned'],
];

describe(runStatusToggle, () => {
  it.each(FEATURES)('/$command puts $flag on and shares the answered post', async (feature) => {
    const answered = status('p', { [feature.flag]: true });
    const paths = serveStatusActions(answered);
    const context = homeContext([POST]);

    const outcome = await runStatusToggle('a0', context, feature.command);

    expect(outcome).toStrictEqual({ ok: true });
    expect(paths).toStrictEqual([`/api/v1/statuses/p/${feature.on}`]);
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'statusUpdated', status: answered });
    expect(context.print).toHaveBeenCalledWith(`${feature.mark} ${feature.verb} [a0]`);
  });

  it.each(FEATURES)('/$command takes $flag back when the post carries it', async (feature) => {
    serveStatusActions(POST);
    const context = homeContext([status('p', { [feature.flag]: true })]);

    const outcome = await runStatusToggle('a0', context, feature.command);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.print).toHaveBeenCalledWith(`${feature.mark} un${feature.verb} [a0]`);
  });

  it.each(UNDOS)('/%s always undoes, flag or no flag', async (command, off, printed) => {
    const paths = serveStatusActions(POST);
    const context = homeContext([POST]);

    const outcome = await runStatusToggle('a0', context, command);

    expect(outcome).toStrictEqual({ ok: true });
    expect(paths).toStrictEqual([`/api/v1/statuses/p/${off}`]);
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'statusUpdated', status: POST });
    expect(context.print).toHaveBeenCalledWith(`${printed} [a0]`);
  });

  it.each(['pin', 'unpin'] as const)(
    '/%s refuses a post of somebody else before sending',
    async (command) => {
      const paths = serveStatusActions(POST);
      const context = homeContext([FOREIGN]);

      const outcome = await runStatusToggle('a0', context, command);

      expect(outcome).toStrictEqual({ ok: false, message: 'You can only pin your own posts' });
      expect(paths).toStrictEqual([]);
      expect(context.dispatch).not.toHaveBeenCalled();
      expect(context.print).not.toHaveBeenCalled();
    },
  );

  it('shares the original inside the wrapper a boost answers with', async () => {
    const boosted = status('p', { reblogged: true });
    const wrapper = status('w', { reblog: boosted });
    serveStatusActions(wrapper);
    const context = homeContext([POST]);

    const outcome = await runStatusToggle('a0', context, 'boost');

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({ type: 'statusUpdated', status: boosted });
    expect(context.print).toHaveBeenCalledWith('⟳ boosted [a0]');
  });

  it('toggles the selected post and prints the label of its line', async () => {
    const answered = status('p', { favourited: true });
    const paths = serveStatusActions(answered);
    const context = homeContext([POST], 'p');

    const outcome = await runStatusToggle('', context, 'fav');

    expect(outcome).toStrictEqual({ ok: true });
    expect(paths).toStrictEqual(['/api/v1/statuses/p/favourite']);
    expect(context.print).toHaveBeenCalledWith('★ favourited [a0]');
  });

  it('toggles the original of a boost under the boost line label', async () => {
    const answered = status('p', { favourited: true });
    const paths = serveStatusActions(answered);
    const context = homeContext([BOOST]);

    const outcome = await runStatusToggle('a0', context, 'fav');

    expect(outcome).toStrictEqual({ ok: true });
    expect(paths).toStrictEqual(['/api/v1/statuses/p/favourite']);
    expect(context.print).toHaveBeenCalledWith('★ favourited [a0]');
  });

  it('names a quoted post by its id, the line it is shown on carrying another', async () => {
    const quoting = status('n', { quote: POST });
    const answered = status('p', { favourited: true });
    const paths = serveStatusActions(answered);
    const context = homeContext([quoting]);

    const outcome = await runStatusToggle('a1', context, 'fav');

    expect(outcome).toStrictEqual({ ok: true });
    expect(paths).toStrictEqual(['/api/v1/statuses/p/favourite']);
    expect(context.print).toHaveBeenCalledWith('★ favourited [p]');
  });

  it('reports the instance turning the toggle down', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/statuses/:id/:action`, () => {
        return HttpResponse.json({ error: 'Record not found' }, { status: 404 });
      }),
    );
    const context = homeContext([POST]);

    const outcome = await runStatusToggle('a0', context, 'bookmark');

    expect(outcome).toStrictEqual({ ok: false, message: 'HTTP 404: Record not found' });
    expect(context.dispatch).not.toHaveBeenCalled();
    expect(context.print).not.toHaveBeenCalled();
  });

  it('refuses a label this window does not have, sending nothing', async () => {
    const paths = serveStatusActions(POST);
    const context = homeContext([POST]);

    const outcome = await runStatusToggle('a9', context, 'fav');

    expect(outcome).toStrictEqual({ ok: false, message: 'No post a9 here' });
    expect(paths).toStrictEqual([]);
  });

  it('refuses to toggle while nothing is selected', async () => {
    const paths = serveStatusActions(POST);
    const context = homeContext([POST]);

    const outcome = await runStatusToggle('', context, 'fav');

    expect(outcome).toStrictEqual({
      ok: false,
      message: 'Select a post first (j/k) or give a label',
    });
    expect(paths).toStrictEqual([]);
  });
});
