/**
 * The settings a reader chooses for themselves (AGENTS.md "Layout": src/state
 * holds the pure app state, settings among it): how the scrollback prints a
 * moment, who a new post is aimed at by default, which theme paints the shell
 * (WFE-131, `/theme`), and whether the CRT effects and media behind a content
 * warning start open. Plain data with one default
 * record, the valibot schema that reads them back from storage (every field
 * optional on input, every default filled in), and {@link SETTING_KEYS}: the
 * per-knob metadata the `/set` command lists and checks itself against.
 * Getting them in and out of storage is the storage module's business. The
 * reader's key overrides (WFE-130) ride along here too — stored and defaulted
 * like every knob, but deliberately absent from SETTING_KEYS: `/set` does not
 * list them, the `/bind` commands own them. The saved feeds (WFE-195) are
 * stored and defaulted the same way and equally hidden from `/set`. Where new
 * windows open (decision 13) is `openIn`, listed; the per-kind choices over it
 * (`openInByKind`) are turned by the dotted `/set openIn.<kind>` form, which
 * ./placement's resolver reads, and are not in SETTING_KEYS.
 */

import * as v from 'valibot';

import { type Feeds, FeedsSchema } from './feeds';
import { type KindPlacements, PLACEMENTS, type Placement, kindPlacements } from './placement';
import type { Visibility } from '../api/schemas/status';
import type { KeyOverride } from '../lib/keyOverride';
import type { ClockFormat } from '../lib/time';

/** The three themes src/theme/tokens.css paints (`/theme`, WFE-131). */
export type Theme = 'wired' | 'lain' | 'bnet';

/** How a window renders posts: as cards, or as IRC lines (decision 15). */
export type Density = 'cards' | 'lines';

/** What the reader can change, one value per knob. */
export type Settings = {
  /** Whether posts show the author's avatar (decision 15). */
  readonly avatars: boolean;
  /** How every timestamp in the scrollback is rendered (src/lib/time). */
  readonly clockFormat: ClockFormat;
  /** The audience a post gets when the command naming it says nothing else. */
  readonly defaultVisibility: Visibility;
  /** Whether posts render as cards or as IRC lines (decision 15). */
  readonly density: Density;
  /** Whether the CRT/glitch effects are on at all; they never flash. */
  readonly effects: boolean;
  /** Whether media behind a content warning is shown without asking. */
  readonly expandMedia: boolean;
  /** The reader's saved feeds (WFE-195, decision 14); stored and synced, not listed by `/set`. */
  readonly feeds: Feeds;
  /** Whether attachments render inline, or as `[IMG …]` placeholder lines. */
  readonly images: boolean;
  /** The reader's own key bindings over the defaults (WFE-130, `/bind`). */
  readonly keyOverrides: readonly KeyOverride[];
  /** Where a newly opened window goes unless its kind or `--in` says otherwise (decision 13). */
  readonly openIn: Placement;
  /** Where windows of a kind go, over {@link openIn}; stored and shown by `/set openIn.<kind>`. */
  readonly openInByKind: KindPlacements;
  /** Which theme paints the shell (src/theme/tokens.css, `/theme`). */
  readonly theme: Theme;
};

/** A session that has changed nothing: a 24-hour clock, public posts, no effects. */
export const DEFAULT_SETTINGS: Settings = {
  avatars: true,
  clockFormat: '24h',
  defaultVisibility: 'public',
  density: 'cards',
  effects: false,
  expandMedia: false,
  feeds: [],
  images: true,
  keyOverrides: [],
  openIn: 'here',
  openInByKind: {},
  theme: 'wired',
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

/** The themes a reader can choose, the default first (src/theme/tokens.css). */
export const THEMES = ['wired', 'lain', 'bnet'] as const satisfies readonly Theme[];

/** The ways a window can render posts, the default first (decision 15). */
export const DENSITIES = ['cards', 'lines'] as const satisfies readonly Density[];

/** One stored key override, as the reader's own bindings come back from storage. */
const KeyOverrideSchema = v.object({
  mode: v.picklist(['insert', 'navigation']),
  chord: v.string(),
  line: v.nullable(v.string()),
});

/** Stored settings: every field optional on input, every default filled on read. */
export const SettingsSchema: v.GenericSchema<unknown, Settings> = v.object({
  avatars: v.optional(v.boolean(), DEFAULT_SETTINGS.avatars),
  clockFormat: v.optional(v.picklist(CLOCK_FORMATS), DEFAULT_SETTINGS.clockFormat),
  defaultVisibility: v.optional(v.picklist(VISIBILITIES), DEFAULT_SETTINGS.defaultVisibility),
  density: v.optional(v.picklist(DENSITIES), DEFAULT_SETTINGS.density),
  effects: v.optional(v.boolean(), DEFAULT_SETTINGS.effects),
  expandMedia: v.optional(v.boolean(), DEFAULT_SETTINGS.expandMedia),
  feeds: v.optional(FeedsSchema, DEFAULT_SETTINGS.feeds),
  images: v.optional(v.boolean(), DEFAULT_SETTINGS.images),
  keyOverrides: v.optional(v.array(KeyOverrideSchema), DEFAULT_SETTINGS.keyOverrides),
  openIn: v.optional(v.picklist(PLACEMENTS), DEFAULT_SETTINGS.openIn),
  openInByKind: v.pipe(
    v.optional(v.record(v.string(), v.picklist(PLACEMENTS)), {}),
    v.transform(kindPlacements),
  ),
  theme: v.optional(v.picklist(THEMES), DEFAULT_SETTINGS.theme),
});

/** The knobs `/set` lists and turns: every setting except the hidden key overrides. */
type ListedSettingKey = Exclude<keyof Settings, 'keyOverrides' | 'feeds' | 'openInByKind'>;

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
    key: 'theme',
    kind: 'enum',
    values: THEMES,
    description: 'The colors the shell is painted in',
  },
];
