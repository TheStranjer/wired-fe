/**
 * Tests for how the build's `publicView` setting treats one instance
 * (decision 3): each mode, listed against unlisted origins, `allowCustom`, and
 * `open`, where an instance no one configured never gets public view.
 */
import { describe, expect, it } from 'vitest';

import type { InstancesConfig } from './instances';
import { type PublicViewConfig, publicViewSetting } from './publicView';

const WIRED = 'https://wired.example';
const OTHER = 'https://other.example';
const STRANGER = 'https://stranger.example';

/** The setting of {@link origin} for a build with {@link instances} and {@link publicView}. */
function setting(
  instances: InstancesConfig,
  publicView: PublicViewConfig | undefined,
  origin: string,
): string {
  return publicViewSetting({ instances, publicView }, origin);
}

describe(publicViewSetting, () => {
  it.each([
    [undefined, 'backend'],
    [null, 'backend'],
    [true, 'force'],
    [false, 'off'],
  ] as const)('same-origin with %s is %s for the origin the caller passes', (value, expected) => {
    expect(setting({ mode: 'same-origin' }, value, WIRED)).toBe(expected);
  });

  it.each([
    [undefined, 'backend'],
    [null, 'backend'],
    [true, 'force'],
    [false, 'off'],
  ] as const)('fixed with %s is %s for the fixed origin', (value, expected) => {
    expect(setting({ mode: 'fixed', origin: WIRED }, value, WIRED)).toBe(expected);
  });

  it('gives a fixed build no public view for any other origin', () => {
    expect(setting({ mode: 'fixed', origin: WIRED }, true, STRANGER)).toBe('off');
  });

  it('applies a boolean to every listed origin', () => {
    const instances: InstancesConfig = { mode: 'list', origins: [WIRED, OTHER] };

    expect(setting(instances, true, WIRED)).toBe('force');
    expect(setting(instances, true, OTHER)).toBe('force');
    expect(setting(instances, false, OTHER)).toBe('off');
    expect(setting(instances, null, OTHER)).toBe('backend');
  });

  it('gives a user-typed instance under allowCustom no public view, whatever the setting', () => {
    const instances: InstancesConfig = { mode: 'list', origins: [WIRED], allowCustom: true };

    expect(setting(instances, true, STRANGER)).toBe('off');
    expect(setting(instances, null, STRANGER)).toBe('off');
    expect(setting(instances, { [WIRED]: true }, STRANGER)).toBe('off');
  });

  it('sets each instance of the object form separately, an unnamed one counting as null', () => {
    const instances: InstancesConfig = { mode: 'list', origins: [WIRED, OTHER] };
    const publicView = { [WIRED]: true };

    expect(setting(instances, publicView, WIRED)).toBe('force');
    expect(setting(instances, publicView, OTHER)).toBe('backend');
    expect(setting(instances, { [WIRED]: false, [OTHER]: null }, WIRED)).toBe('off');
    expect(setting(instances, { [WIRED]: false, [OTHER]: null }, OTHER)).toBe('backend');
  });

  it('applies the object form to the fixed origin', () => {
    const instances: InstancesConfig = { mode: 'fixed', origin: WIRED };

    expect(setting(instances, { [WIRED]: true }, WIRED)).toBe('force');
    expect(setting(instances, {}, WIRED)).toBe('backend');
  });

  it('gives every instance of an open build no public view, null meaning off', () => {
    expect(setting({ mode: 'open' }, null, WIRED)).toBe('off');
    expect(setting({ mode: 'open' }, undefined, WIRED)).toBe('off');
    expect(setting({ mode: 'open' }, false, WIRED)).toBe('off');
    expect(setting({ mode: 'open' }, true, WIRED)).toBe('off');
  });
});
