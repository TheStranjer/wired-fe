/**
 * Tests for the navigator reader: each field it forwards, and the real
 * navigator's class.
 */
import { describe, expect, it } from 'vitest';

import { DEVICE_CLASS, readDeviceClass } from './readDeviceClass';

describe(readDeviceClass, () => {
  it('reads an Android user agent as mobile', () => {
    expect(readDeviceClass({ userAgent: 'Mozilla/5.0 (Linux; Android 14)' })).toBe('mobile');
  });

  it('reads a touch Mac through platform and touch points', () => {
    expect(readDeviceClass({ userAgent: 'x', platform: 'MacIntel', maxTouchPoints: 5 })).toBe(
      'mobile',
    );
  });

  it('lets the client hint win', () => {
    const nav = { userAgent: 'Android', userAgentData: { mobile: false } };

    expect(readDeviceClass(nav)).toBe('desktop');
  });

  it('reads an empty hint object as no hint', () => {
    expect(readDeviceClass({ userAgent: 'Windows', userAgentData: {} })).toBe('desktop');
  });

  it('reads the real navigator once into DEVICE_CLASS', () => {
    expect(DEVICE_CLASS).toBe(readDeviceClass(navigator));
  });
});
