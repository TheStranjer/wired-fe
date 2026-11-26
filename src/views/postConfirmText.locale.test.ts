/**
 * Tests that the words a post carries follow the language (decision 19,
 * WFE-321): the confirmation of a delete, block or mute, the content-warning
 * excerpts of a post and a quote, and the thread a reply answers.
 */
import { describe, expect, it } from 'vitest';

import { postConfirmText } from './postConfirmText';
import { postWords } from './postLabels';
import { postView } from './postView';
import { excerptOf } from './quoteView';
import { status } from '../test/fixtures';
import { installFakeLocale } from '../test/i18n';

/** What the confirmation shows of a post: its author and its body. */
const VIEWER = { origin: 'https://wired.example', accountId: null };
const VIEW = postView(status('p', { content: '<p>bye</p>' }), VIEWER);

/** A language that words each of those differently. */
const FAKE = {
  views: {
    confirm: {
      block: 'BLOCK IT',
      block_message: 'BLOCKED',
      block_title: 'BLOCK {handle}',
      delete: 'DELETE IT',
      delete_message: 'GONE',
      delete_message_excerpt: 'GONE "{excerpt}"',
      delete_title: 'DELETE [{label}]',
      mute: 'MUTE IT',
      mute_message: 'MUTED',
      mute_title: 'MUTE {handle}',
    },
    post: { a_thread: 'THREAD', content_warning: 'WARN {warning}' },
    quote: { content_warning: '[WARN {warning}]' },
  },
};

describe(postConfirmText, () => {
  it('words the delete question in it, with and without the post words', () => {
    installFakeLocale(FAKE);

    expect(postConfirmText('delete', 'a3', VIEW)).toStrictEqual({
      title: 'DELETE [a3]',
      message: 'GONE "bye"',
      confirmLabel: 'DELETE IT',
    });
    expect(
      postConfirmText('delete', 'a3', postView(status('p', { content: '' }), VIEWER)).message,
    ).toBe('GONE');
  });

  it('words the block and mute questions in it', () => {
    installFakeLocale(FAKE);

    expect(postConfirmText('block', 'a3', VIEW)).toStrictEqual({
      title: 'BLOCK @lain@wired.example',
      message: 'BLOCKED',
      confirmLabel: 'BLOCK IT',
    });
    expect(postConfirmText('mute', 'a3', VIEW)).toStrictEqual({
      title: 'MUTE @lain@wired.example',
      message: 'MUTED',
      confirmLabel: 'MUTE IT',
    });
  });
});

describe('the words of a post in another language', () => {
  it('words the content warning of a post and of a quote in it', () => {
    installFakeLocale(FAKE);
    const warned = status('w', { spoiler_text: 'spiders' });

    expect(postWords(warned)).toBe('<@lain@wired.example> WARN spiders');
    expect(excerptOf(warned)).toBe('[WARN spiders]');
  });

  it('words the thread a reply answers in it', () => {
    installFakeLocale(FAKE);
    const reply = status('r', { in_reply_to_id: '9', in_reply_to_account_id: '404' });

    expect(postView(reply, VIEWER).replyTo).toBe('THREAD');
  });
});
