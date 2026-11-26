/**
 * The fixed words of a notification card (./NotificationCard): the glyph each
 * kind leads its line with, and the message of what the kinds that act on a
 * post say after the actor. Data only; the message is read with `t()` when a
 * card is drawn, never at module load (decision 19).
 */
import type { NotificationKind } from '../api/schemas/notification';
import type { MessageKey } from '../i18n/messages';

/** The glyph each kind leads its line with; a reaction shows its own emoji instead. */
export const GLYPHS: Record<NotificationKind, string> = {
  mention: '@',
  quote: '@',
  favourite: '★',
  reblog: '⟳',
  reaction: '☺',
  poll: '☰',
  update: '✎',
  status: '●',
  follow: '*',
  follow_request: '*',
  move: '*',
  quoted_update: '✎',
  sign_up: '*',
  report: '*',
  chat_mention: '*',
  severed_relationships: '*',
  moderation_warning: '*',
  annual_report: '*',
  other: '*',
};

/** The message of what the kinds that act on a post say after the actor. */
export const VERBS: Partial<Record<NotificationKind, MessageKey>> = {
  mention: 'views.notification_card.mention',
  quote: 'views.notification_card.quote',
  favourite: 'views.notification_card.favourite',
  reblog: 'views.notification_card.reblog',
  reaction: 'views.notification_card.reaction',
  update: 'views.notification_card.update',
  status: 'views.notification_card.status',
};
