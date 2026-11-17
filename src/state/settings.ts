/**
 * The settings a reader chooses for themselves (AGENTS.md "Layout": src/state
 * holds the pure app state, settings among it): how the scrollback prints a
 * moment, who a new post is aimed at by default, and whether the CRT effects
 * and media behind a content warning start open. Plain data with one default
 * record, the valibot schema that reads them back from storage (every field
 * optional on input, every default filled in), and {@link SETTING_KEYS}: the
 * per-knob metadata the `/set` command lists and checks itself against.
 * Getting them in and out of storage is the storage module's business.
 */

import * as v from 'valibot';

import type { Visibility } from '../api/schemas/status';
import type { ClockFormat } from '../lib/time';

/** What the reader can change, one value per knob. */
export type Settings = {
  /** How every timestamp in the scrollback is rendered (src/lib/time). */
  readonly clockFormat: ClockFormat;
  /** The audience a post gets when the command naming it says nothing else. */
  readonly defaultVisibility: Visibility;
  /** Whether the CRT/glitch effects are on at all; they never flash. */
  readonly effects: boolean;
  /** Whether media behind a content warning is shown without asking. */
  readonly expandMedia: boolean;
};

/** A session that has changed nothing: a 24-hour clock, public posts, no effects. */
export const DEFAULT_SETTINGS: Settings = {
  clockFormat: '24h',
  defaultVisibility: 'public',
  effects: false,
  expandMedia: false,
};

/** The two ways the scrollback prints a moment (src/lib/time). */
export const CLOCK_FORMATS = ['24h', '12h'] as const satisfies readonly ClockFormat[];

/** The five audiences a post can aim at (src/api/schemas/status). */
export const VISIBILITIES = [
  'public',
  'unlisted',
  'private',
  'direct',
  'local',
] as const satisfies readonly Visibility[];

/** Stored settings: every field optional on input, every default filled on read. */
export const SettingsSchema: v.GenericSchema<unknown, Settings> = v.object({
  clockFormat: v.optional(v.picklist(CLOCK_FORMATS), DEFAULT_SETTINGS.clockFormat),
  defaultVisibility: v.optional(v.picklist(VISIBILITIES), DEFAULT_SETTINGS.defaultVisibility),
  effects: v.optional(v.boolean(), DEFAULT_SETTINGS.effects),
  expandMedia: v.optional(v.boolean(), DEFAULT_SETTINGS.expandMedia),
});

/** One knob the reader can set, as the `/set` command lists and checks it. */
export type SettingKey = {
  /** Which field of {@link Settings} it turns. */
  readonly key: keyof Settings;
  /** Whether the knob takes one of {@link values} or an on/off word. */
  readonly kind: 'enum' | 'boolean';
  /** The words an enum knob takes; absent for a boolean one. */
  readonly values?: readonly string[];
  /** One line saying what the knob does, printed beside its value. */
  readonly description: string;
};

/** Every setting, in the order `/set` prints them. */
export const SETTING_KEYS: readonly SettingKey[] = [
  {
    key: 'clockFormat',
    kind: 'enum',
    values: CLOCK_FORMATS,
    description: 'How timestamps print: 24-hour or 12-hour',
  },
  {
    key: 'defaultVisibility',
    kind: 'enum',
    values: VISIBILITIES,
    description: 'The audience new posts aim at by default',
  },
  {
    key: 'effects',
    kind: 'boolean',
    description: 'The CRT/glitch effects (they never flash)',
  },
  {
    key: 'expandMedia',
    kind: 'boolean',
    description: 'Media behind a content warning starts open',
  },
];
