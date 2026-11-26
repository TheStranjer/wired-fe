/**
 * The languages WiredFE's own text comes in (decision 19): each with the code
 * its catalog file and `<html lang>` use, its name in its own language and its
 * name in English, so the language setting can match what the reader types
 * against all three. Pure data.
 */

/** Every supported language; English is the source and the fallback. */
export const SUPPORTED_LOCALES = [
  { code: 'en', native: 'English', english: 'English' },
  { code: 'es', native: 'Español', english: 'Spanish' },
  { code: 'ru', native: 'Русский', english: 'Russian' },
  { code: 'ja', native: '日本語', english: 'Japanese' },
  { code: 'zh-Hans', native: '简体中文', english: 'Chinese' },
  { code: 'de', native: 'Deutsch', english: 'German' },
] as const;

/** The code of a supported language: `en`, `es`, `ru`, `ja`, `zh-Hans` or `de`. */
export type Locale = (typeof SUPPORTED_LOCALES)[number]['code'];
