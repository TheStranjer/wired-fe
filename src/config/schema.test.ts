/**
 * Tests for the build-time configuration schema and its parse function.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { type WiredConfig, WiredConfigSchema, parseWiredConfig } from './schema';

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

describe(parseWiredConfig, () => {
  it('accepts same-origin', () => {
    expect(parsed({ appName: 'WiredFE', instances: { mode: 'same-origin' } })).toStrictEqual({
      appName: 'WiredFE',
      instances: { mode: 'same-origin' },
    });
  });

  it('accepts a fixed https origin', () => {
    expect(
      parsed({ appName: 'WiredFE', instances: { mode: 'fixed', origin: 'https://wired.example' } }),
    ).toStrictEqual({
      appName: 'WiredFE',
      instances: { mode: 'fixed', origin: 'https://wired.example' },
    });
  });

  it('accepts open', () => {
    expect(parsed({ appName: 'WiredFE', instances: { mode: 'open' } }).instances).toStrictEqual({
      mode: 'open',
    });
  });

  it('accepts a fixed http origin on localhost', () => {
    expect(
      parsed({ appName: 'WiredFE', instances: { mode: 'fixed', origin: 'http://localhost:4000' } })
        .instances,
    ).toStrictEqual({ mode: 'fixed', origin: 'http://localhost:4000' });
  });

  it('accepts a fixed http origin on 127.0.0.1', () => {
    expect(
      parsed({ appName: 'WiredFE', instances: { mode: 'fixed', origin: 'http://127.0.0.1:4000' } })
        .instances,
    ).toStrictEqual({ mode: 'fixed', origin: 'http://127.0.0.1:4000' });
  });

  it('trims the app name', () => {
    expect(parsed({ appName: '  WiredFE  ', instances: { mode: 'open' } }).appName).toBe('WiredFE');
  });

  it('rejects a missing appName', () => {
    expect(mentionsField(messages({ instances: { mode: 'open' } }), 'appName')).toBe(true);
  });

  it('rejects an empty appName', () => {
    expect(mentionsField(messages({ appName: '', instances: { mode: 'open' } }), 'appName')).toBe(
      true,
    );
  });

  it('rejects a blank appName', () => {
    expect(
      mentionsField(messages({ appName: '   ', instances: { mode: 'open' } }), 'appName'),
    ).toBe(true);
  });

  it('rejects a 65-character appName', () => {
    const issues = messages({ appName: 'a'.repeat(65), instances: { mode: 'open' } });

    expect(mentionsField(issues, 'appName')).toBe(true);
  });

  it('rejects an unknown mode', () => {
    const issues = messages({ appName: 'WiredFE', instances: { mode: 'any' } });

    expect(mentionsField(issues, 'instances.mode')).toBe(true);
  });

  it('rejects a fixed origin with a path', () => {
    const issues = messages({
      appName: 'WiredFE',
      instances: { mode: 'fixed', origin: 'https://wired.example/app' },
    });

    expect(mentionsField(issues, 'instances.origin')).toBe(true);
  });

  it('rejects a fixed origin with a trailing slash', () => {
    const issues = messages({
      appName: 'WiredFE',
      instances: { mode: 'fixed', origin: 'https://wired.example/' },
    });

    expect(mentionsField(issues, 'instances.origin')).toBe(true);
  });

  it('rejects a plain http origin that is not local', () => {
    const issues = messages({
      appName: 'WiredFE',
      instances: { mode: 'fixed', origin: 'http://wired.example' },
    });

    expect(mentionsField(issues, 'instances.origin')).toBe(true);
  });

  it('rejects a string that is not a URL', () => {
    const issues = messages({ appName: 'WiredFE', instances: { mode: 'fixed', origin: 'wired' } });

    expect(mentionsField(issues, 'instances.origin')).toBe(true);
  });

  it('rejects an unknown top-level key', () => {
    const issues = messages({ appName: 'WiredFE', instances: { mode: 'open' }, extra: true });

    expect(issues.some((message) => message.includes('extra'))).toBe(true);
  });

  it('rejects an unknown key inside an instances object', () => {
    const issues = messages({
      appName: 'WiredFE',
      instances: { mode: 'open', origin: 'https://x.example' },
    });

    expect(issues.some((message) => message.includes('origin'))).toBe(true);
  });

  it('reports (root) when the input is not an object at all', () => {
    const issues = messages('WiredFE');

    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]?.startsWith('(root): ')).toBe(true);
  });

  it('delegates to the exported schema, producing the same output', () => {
    const input = { appName: 'WiredFE', instances: { mode: 'same-origin' } };

    expect(v.parse(WiredConfigSchema, input)).toStrictEqual(parsed(input));
  });
});
