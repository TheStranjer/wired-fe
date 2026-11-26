/**
 * What makes a post card a direct message (WFE-234): the sender and recipients
 * the header strip names, the chat-bubble placement a DM window gives it, and
 * the class list that follows. Pure functions over plain data, split out of
 * {@link PostCard}.
 */
import type { DmStrip } from './CardHead';
import { t } from '../i18n/translate';

/** One account a direct message names, as the strip shows it. */
export type DmRecipient = {
  readonly handle: string;
  /** True when it is the viewer, who the strip calls `you`. */
  readonly self: boolean;
};

/** How a card sits as a chat bubble in a DM window. */
export type ChatMark = {
  /** True for the viewer's own message: right-aligned, named `you`. */
  readonly own: boolean;
  /** True when the message above is the same author's within minutes: no header. */
  readonly collapsed: boolean;
};

/** The facts about a card the DM strip and classes read. */
type DmInput = {
  readonly visibility: string;
  readonly author: { readonly handle: string; readonly self: boolean };
  readonly recipients: readonly DmRecipient[];
  readonly chat: ChatMark | null;
};

/** What the viewer is called on a card, in the language in use. */
function you(): string {
  return t('ui.card_dm.you');
}

/** The name a DM shows for one account: `you` for the viewer, else the handle. */
function nameOf(account: { readonly handle: string; readonly self: boolean }): string {
  return account.self ? you() : account.handle;
}

/**
 * The strip of a direct card seen outside a DM window: who sent it and who it
 * names. Null for any other post and for a chat bubble, whose window already
 * says who the conversation is with.
 */
export function dmStrip(input: DmInput): DmStrip | null {
  if (input.visibility !== 'direct' || input.chat !== null) {
    return null;
  }
  return { from: nameOf(input.author), to: input.recipients.map(nameOf) };
}

/** The display name a card shows: `you` for the viewer's own bubble. */
export function bubbleName(chat: ChatMark | null, name: string): string {
  return chat?.own === true ? you() : name;
}

/** The CSS module keys a card takes, in order, for its audience, placement and selection. */
export function cardClassKeys(input: DmInput, selected: boolean): readonly string[] {
  return [
    'card',
    input.visibility === 'direct' ? 'direct' : '',
    input.chat === null ? '' : 'bubble',
    input.chat?.own === true ? 'own' : '',
    selected ? 'selected' : '',
  ].filter((key) => key !== '');
}
