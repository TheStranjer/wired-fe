/**
 * The metadata of the knobs `/set` lists and turns (src/commands/defs/set): one
 * {@link SettingKey} per listed setting, with its kind, its words and a line of
 * description. The hidden settings (key overrides, feeds, the language, per-kind
 * placements, the first-run flag, the posting account) are not here. The
 * descriptions are getters (decision 19), so they follow the language in use.
 */

import { PLACEMENTS } from './placement';
import { CLOCK_FORMATS, DENSITIES, type Settings, THEMES, VISIBILITIES } from './settings';
import { t } from '../i18n/translate';

/** The knobs `/set` lists and turns: every setting except the hidden key overrides. */
type ListedSettingKey = Exclude<
  keyof Settings,
  'keyOverrides' | 'feeds' | 'language' | 'openInByKind' | 'postAs' | 'streamMade'
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
    get description(): string {
      return t('state.setting_avatars');
    },
  },
  {
    key: 'clockFormat',
    kind: 'enum',
    values: CLOCK_FORMATS,
    get description(): string {
      return t('state.setting_clock_format');
    },
  },
  {
    key: 'defaultVisibility',
    kind: 'enum',
    values: VISIBILITIES,
    get description(): string {
      return t('state.setting_default_visibility');
    },
  },
  {
    key: 'density',
    kind: 'enum',
    values: DENSITIES,
    get description(): string {
      return t('state.setting_density');
    },
  },
  {
    key: 'effects',
    kind: 'boolean',
    get description(): string {
      return t('state.setting_effects');
    },
  },
  {
    key: 'expandMedia',
    kind: 'boolean',
    get description(): string {
      return t('state.setting_expand_media');
    },
  },
  {
    key: 'images',
    kind: 'boolean',
    get description(): string {
      return t('state.setting_images');
    },
  },
  {
    key: 'openIn',
    kind: 'enum',
    values: PLACEMENTS,
    get description(): string {
      return t('state.setting_open_in');
    },
  },
  {
    key: 'replyIn',
    kind: 'enum',
    values: PLACEMENTS,
    get description(): string {
      return t('state.setting_reply_in');
    },
  },
  {
    key: 'theme',
    kind: 'enum',
    values: THEMES,
    get description(): string {
      return t('state.setting_theme');
    },
  },
];
