/**
 * Table test of deviceClass over real-world user agent strings, the
 * `mobileHint` override and the touch-screen Mac rule.
 */
import { describe, expect, it } from 'vitest';

import { type DeviceClass, type DeviceInput, deviceClass } from './deviceClass';

type Row = readonly [name: string, input: DeviceInput, expected: DeviceClass];

const ROWS: readonly Row[] = [
  [
    'Chrome on Windows',
    {
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      platform: 'Win32',
    },
    'desktop',
  ],
  [
    'Firefox on Windows',
    {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
      platform: 'Win32',
    },
    'desktop',
  ],
  [
    'Edge on Windows',
    {
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
    },
    'desktop',
  ],
  [
    'Safari on macOS',
    {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 0,
    },
    'desktop',
  ],
  [
    'Firefox on Linux',
    {
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
      platform: 'Linux x86_64',
    },
    'desktop',
  ],
  [
    'Chrome on ChromeOS',
    {
      userAgent:
        'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    },
    'desktop',
  ],
  [
    'Chrome on Android',
    {
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
      platform: 'Linux armv81',
      maxTouchPoints: 5,
    },
    'mobile',
  ],
  [
    'Samsung Internet',
    {
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
    },
    'mobile',
  ],
  [
    'Safari on iPhone',
    {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
    },
    'mobile',
  ],
  [
    'iPod touch',
    {
      userAgent:
        'Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    },
    'mobile',
  ],
  [
    'iPad, mobile mode',
    {
      userAgent:
        'Mozilla/5.0 (iPad; CPU OS 12_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Mobile/15E148 Safari/604.1',
      platform: 'iPad',
    },
    'mobile',
  ],
  [
    'iPad, desktop mode (iPadOS 13+)',
    {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    },
    'mobile',
  ],
  [
    'Mac claimed by platform only, with touch',
    { userAgent: 'Mozilla/5.0', platform: 'MacIntel', maxTouchPoints: 5 },
    'mobile',
  ],
  ['Mac with no touch field', { userAgent: 'Macintosh', platform: 'MacIntel' }, 'desktop'],
  ['Mac with a single touch point', { userAgent: 'Macintosh', maxTouchPoints: 1 }, 'desktop'],
  ['unknown agent', { userAgent: 'curl/8.0' }, 'desktop'],
  ['empty agent', { userAgent: '' }, 'desktop'],
  [
    'hint says mobile on a desktop UA',
    { userAgent: 'Windows NT 10.0', mobileHint: true },
    'mobile',
  ],
  ['hint says desktop on an Android UA', { userAgent: 'Android 14', mobileHint: false }, 'desktop'],
  [
    'hint says desktop on a touch Mac',
    { userAgent: 'Macintosh', maxTouchPoints: 5, mobileHint: false },
    'desktop',
  ],
];

describe(deviceClass, () => {
  it.each(ROWS)('%s', (_name, input, expected) => {
    expect(deviceClass(input)).toBe(expected);
  });
});
