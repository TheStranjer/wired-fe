/**
 * Tests for choosing the config file path and for reading, JSON-parsing and
 * validating it.
 */
import { describe, expect, it } from 'vitest';

import { configPath, loadConfig } from './loadConfig';

describe(configPath, () => {
  it('uses WIRED_CONFIG resolved against the root when set', () => {
    expect(configPath('/srv/app', { WIRED_CONFIG: 'conf/prod.json' }, () => false)).toBe(
      '/srv/app/conf/prod.json',
    );
  });

  it('keeps an absolute WIRED_CONFIG as it is', () => {
    expect(configPath('/srv/app', { WIRED_CONFIG: '/etc/wired.json' }, () => false)).toBe(
      '/etc/wired.json',
    );
  });

  it('ignores an empty WIRED_CONFIG and takes wired.config.json when it exists', () => {
    const exists = (path: string) => path === '/srv/app/wired.config.json';

    expect(configPath('/srv/app', { WIRED_CONFIG: '' }, exists)).toBe('/srv/app/wired.config.json');
  });

  it('falls back to wired.config.example.json when wired.config.json is absent', () => {
    expect(configPath('/srv/app', {}, () => false)).toBe('/srv/app/wired.config.example.json');
  });
});

describe(loadConfig, () => {
  /** A fake reader returning fixed text for any path. */
  function reader(text: string): (path: string) => string {
    return () => text;
  }

  it('parses and validates a good file, trimming the app name', () => {
    const config = loadConfig(
      '/srv/app/wired.config.json',
      reader(
        '{ "appName": "  WIRED  ", "instances": { "mode": "fixed", "origin": "https://wired.example" } }',
      ),
    );

    expect(config).toStrictEqual({
      appName: 'WIRED',
      instances: { mode: 'fixed', origin: 'https://wired.example' },
    });
  });

  it('names the file and says invalid JSON when the file does not parse', () => {
    expect(() => loadConfig('/srv/app/wired.config.json', reader('{ appName: '))).toThrow(
      /\/srv\/app\/wired\.config\.json: invalid JSON: /,
    );
  });

  it('says invalid config and lists every problem on its own line', () => {
    let message = '';
    try {
      loadConfig(
        '/srv/app/wired.config.json',
        reader('{ "appName": "", "instances": { "mode": "nope" }, "extra": 1 }'),
      );
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    const lines = message.split('\n');

    expect(lines[0]).toBe('/srv/app/wired.config.json: invalid config');
    expect(lines.length).toBeGreaterThan(2);
    expect(lines.some((line) => line.startsWith('appName: '))).toBe(true);
    expect(lines.some((line) => line.startsWith('instances.mode: '))).toBe(true);
    expect(lines.some((line) => line.startsWith('extra: '))).toBe(true);
  });

  it('fails on an empty origins list that forbids custom instances', () => {
    expect(() =>
      loadConfig(
        '/srv/app/wired.config.json',
        reader('{ "appName": "WIRED", "instances": { "mode": "list", "origins": [] } }'),
      ),
    ).toThrow(/instances: an empty origins list needs allowCustom: true/);
  });

  it('keeps a supported defaultLocale', () => {
    const config = loadConfig(
      '/srv/app/wired.config.json',
      reader(
        '{ "appName": "WIRED", "instances": { "mode": "same-origin" }, "defaultLocale": "de" }',
      ),
    );

    expect(config.defaultLocale).toBe('de');
  });

  it('fails on a well-formed but unsupported defaultLocale', () => {
    expect(() =>
      loadConfig(
        '/srv/app/wired.config.json',
        reader(
          '{ "appName": "WIRED", "instances": { "mode": "same-origin" }, "defaultLocale": "fr" }',
        ),
      ),
    ).toThrow(/defaultLocale: "fr" is not supported; use one of en, es, ru, ja, zh-Hans, de/);
  });
});
