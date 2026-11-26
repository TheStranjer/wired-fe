/**
 * The metadata of the knobs `/set` lists and turns (src/commands/defs/set): one
 * {@link SettingKey} per listed setting, with its kind, its words and a line of
 * description. The hidden settings (key overrides, feeds, per-kind placements,
 * the first-run flag, the posting account) are not here.
 */

import { PLACEMENTS } from './placement';
import { CLOCK_FORMATS, DENSITIES, type Settings, THEMES, VISIBILITIES } from './settings';

/** The knobs `/set` lists and turns: every setting except the hidden key overrides. */
type ListedSettingKey = Exclude<
  keyof Settings,
  'keyOverrides' | 'feeds' | 'openInByKind' | 'postAs' | 'streamMade'
>;

/** One knob the reader can set, as the `/set` command lists and checks it. */
export type SettingKey = {
  /** Which field of {@link Settings} it turns — a listed one; the key overrides are not a knob. */
  readonly key: ListedSettingKey;
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
    key: 'avatars',
    kind: 'boolean',
    description: 'Show author avatars on posts',
  },
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
    key: 'density',
    kind: 'enum',
    values: DENSITIES,
    description: 'How posts render: as cards or as IRC lines',
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
  {
    key: 'images',
    kind: 'boolean',
    description: 'Show attachments inline instead of [IMG …] lines',
  },
  {
    key: 'openIn',
    kind: 'enum',
    values: PLACEMENTS,
    description: 'Where new windows open: here, vsplit, split, float or hidden',
  },
  {
    key: 'replyIn',
    kind: 'enum',
    values: PLACEMENTS,
    description: 'Where a reply composer opens: here, vsplit, split, float or hidden',
  },
  {
    key: 'theme',
    kind: 'enum',
    values: THEMES,
    description: 'The colors the shell is painted in',
  },
];
