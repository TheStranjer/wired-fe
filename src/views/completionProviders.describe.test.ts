/**
 * Tests for the rows the suggestion list draws for the providers of
 * ./completionProviders (WFE-300): a handle is described by the display name
 * the server wrote (`:shortcode:` text kept as text), a tag by nothing, an
 * emoji by its still image when that is an https URL; handles the instance's
 * search found come below the ones the buffers showed, without repeating one
 * and only for the word they were searched for.
 */
import { describe, expect, it } from 'vitest';

import {
  type HandleSearch,
  emojiProvider,
  handleProvider,
  tagProvider,
} from './completionProviders';
import { withoutReactionWords } from './reactionProviders';
import type { CustomEmoji } from '../api/schemas/customEmoji';
import { ACCOUNT, author, mention, sessionWith, tag } from '../test/completionSessions';
import { status } from '../test/fixtures';

/** The state where alice (named, with a custom emoji) and a mention-only bob were shown. */
const SHOWN = sessionWith({
  accounts: [ACCOUNT],
  statuses: [
    status('a1', {
      account: { ...author('alice@m.example'), display_name: 'Alice :blobcat: <b>Liddell</b>' },
      mentions: [mention('bob@m.example')],
      tags: [tag('zen')],
    }),
    status('a2', { account: author('carol@m.example'), mentions: [mention('alice@m.example')] }),
  ],
});

/** What the instance's search found for `@al`. */
const FOUND: HandleSearch = new Map([
  [
    '@al',
    [
      { word: '@alex@o.example', name: 'Alexandra' },
      { word: '@ALICE@m.example', name: 'Alice Again' },
      { word: '@alex@o.example', name: 'Alexandra twice' },
    ],
  ],
  ['@zz', [{ word: '@zed@o.example', name: 'Zed' }]],
]);

describe('the handle rows', () => {
  it('describe a handle by its display name, as plain text', () => {
    const provider = handleProvider(SHOWN);

    expect(provider.describe?.('@alice@m.example')).toStrictEqual({
      word: '@alice@m.example',
      label: '@alice@m.example',
      description: 'Alice :blobcat: <b>Liddell</b>',
    });
  });

  it('describe a handle nobody named by nothing', () => {
    const provider = handleProvider(SHOWN);

    expect(provider.describe?.('@bob@m.example')?.description).toBe('');
    expect(provider.describe?.('@lain@wired.example')?.description).toBe('');
    expect(provider.describe?.('@nobody@m.example')?.description).toBe('');
  });

  it('put the accounts the search found below the ones the buffers showed', () => {
    const provider = handleProvider(SHOWN, FOUND);

    expect(provider.candidates('@al')).toStrictEqual(['@alice@m.example', '@alex@o.example']);
    expect(provider.describe?.('@alex@o.example')?.description).toBe('Alexandra');
  });

  it('do not offer what was searched for another word', () => {
    const provider = handleProvider(SHOWN, FOUND);

    expect(provider.candidates('@ali')).toStrictEqual(['@alice@m.example']);
    expect(provider.candidates('@ZZ')).toStrictEqual(['@zed@o.example']);
  });

  it('prefer the display name a buffer carried over the one the search found', () => {
    const state = sessionWith({ statuses: [status('b1', { account: author('alex@o.example') })] });
    const provider = handleProvider(state, FOUND);

    expect(provider.describe?.('@alex@o.example')?.description).toBe('alex');
  });
});

describe('the tag rows', () => {
  it('have a name and no description', () => {
    expect(tagProvider(SHOWN).describe?.('#zen')).toStrictEqual({
      word: '#zen',
      label: '#zen',
      description: '',
    });
  });
});

/** An emoji of {@link shortcode} whose still image is {@link still}. */
function emoji(shortcode: string, still: string): CustomEmoji {
  return {
    shortcode,
    url: 'https://wired.example/e/animated.gif',
    static_url: still,
    visible_in_picker: true,
    category: null,
  };
}

describe('the emoji rows', () => {
  const provider = emojiProvider([
    emoji('Fox', 'https://wired.example/e/fox.png'),
    emoji('plain', 'http://wired.example/e/plain.png'),
  ]);

  it('show the still image beside the shortcode', () => {
    expect(provider.describe?.(':Fox:')).toStrictEqual({
      word: ':Fox:',
      label: ':Fox:',
      description: '',
      image: 'https://wired.example/e/fox.png',
    });
    expect(provider.describe?.(':fox:')?.image).toBe('https://wired.example/e/fox.png');
  });

  it('show no image for an emoji without an https one, or for an unknown shortcode', () => {
    expect(provider.describe?.(':plain:')).toStrictEqual({
      word: ':plain:',
      label: ':plain:',
      description: '',
    });
    expect(provider.describe?.(':nothing:')?.image).toBeUndefined();
  });

  it('stay when a reaction line makes the provider stand aside', () => {
    const guarded = withoutReactionWords(provider);

    expect(guarded.describe?.(':Fox:')?.image).toBe('https://wired.example/e/fox.png');
    expect(guarded.accepts(':fo', false, '/react a1 :fo')).toBe(false);
  });
});
