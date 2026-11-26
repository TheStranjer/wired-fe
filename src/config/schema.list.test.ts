/**
 * Tests for the `list` instance mode of the build-time configuration: the
 * `allowCustom` flag and the empty-list rule (decision 3).
 */
import { describe, expect, it } from 'vitest';

import { type InstancesConfig, type WiredConfig, parseWiredConfig } from './schema';

/** Parses input that must be valid and returns the configuration. */
function parsed(input: unknown): WiredConfig {
  const result = parseWiredConfig(input);
  if (!result.ok) {
    throw new Error(`expected ok, got: ${result.error.join('; ')}`);
  }

  return result.value;
}

/** Parses input that must be invalid and returns the issue messages. */
function messages(input: unknown): readonly string[] {
  const result = parseWiredConfig(input);
  if (result.ok) {
    throw new Error(`expected err, got: ${JSON.stringify(result.value)}`);
  }

  return result.error;
}

/** True when at least one message carries a path naming {@link field}. */
function mentionsField(all: readonly string[], field: string): boolean {
  return all.some((message) => message.startsWith(`${field}: `));
}

describe('list instances', () => {
  it('accepts a list of two origins', () => {
    const origins = ['https://wired.example', 'https://pleroma.example'];
    const instances: InstancesConfig = parsed({
      appName: 'WiredFE',
      instances: { mode: 'list', origins },
    }).instances;

    expect(instances).toStrictEqual({ mode: 'list', origins, allowCustom: false });
  });

  it('reads an absent allowCustom as false', () => {
    const instances = parsed({
      appName: 'WiredFE',
      instances: { mode: 'list', origins: ['https://wired.example'] },
    }).instances;

    expect(instances).toMatchObject({ allowCustom: false });
  });

  it('keeps allowCustom on a non-empty list', () => {
    const origins = ['https://wired.example'];
    const instances = parsed({
      appName: 'WiredFE',
      instances: { mode: 'list', origins, allowCustom: true },
    }).instances;

    expect(instances).toStrictEqual({ mode: 'list', origins, allowCustom: true });
  });

  it('accepts an empty list with allowCustom', () => {
    const instances = parsed({
      appName: 'WiredFE',
      instances: { mode: 'list', origins: [], allowCustom: true },
    }).instances;

    expect(instances).toStrictEqual({ mode: 'list', origins: [], allowCustom: true });
  });

  it('rejects an empty list with allowCustom false, saying why', () => {
    const issues = messages({
      appName: 'WiredFE',
      instances: { mode: 'list', origins: [], allowCustom: false },
    });

    expect(issues).toStrictEqual(['instances: an empty origins list needs allowCustom: true']);
  });

  it('rejects an empty list with allowCustom absent, saying why', () => {
    const issues = messages({ appName: 'WiredFE', instances: { mode: 'list', origins: [] } });

    expect(issues).toStrictEqual(['instances: an empty origins list needs allowCustom: true']);
  });

  it('rejects a non-boolean allowCustom', () => {
    const issues = messages({
      appName: 'WiredFE',
      instances: { mode: 'list', origins: [], allowCustom: 'yes' },
    });

    expect(mentionsField(issues, 'instances.allowCustom')).toBe(true);
  });

  it('rejects a duplicate origin even with allowCustom', () => {
    const issues = messages({
      appName: 'WiredFE',
      instances: {
        mode: 'list',
        origins: ['https://wired.example', 'https://wired.example'],
        allowCustom: true,
      },
    });

    expect(mentionsField(issues, 'instances.origins')).toBe(true);
  });

  it('rejects a list with a duplicate origin', () => {
    const issues = messages({
      appName: 'WiredFE',
      instances: { mode: 'list', origins: ['https://wired.example', 'https://wired.example'] },
    });

    expect(mentionsField(issues, 'instances.origins')).toBe(true);
  });

  it('rejects a bad origin inside a list, naming its index', () => {
    const issues = messages({
      appName: 'WiredFE',
      instances: { mode: 'list', origins: ['https://wired.example', 'http://elsewhere.example'] },
    });

    expect(mentionsField(issues, 'instances.origins.1')).toBe(true);
  });
});
