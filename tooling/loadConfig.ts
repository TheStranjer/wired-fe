/**
 * Loading of the build-time configuration file (decision 3) for the Vite
 * config: which file to read, then reading, JSON-parsing and validating it.
 * Filesystem access is injected, so the selection and validation logic is
 * testable without touching disk.
 */
import { resolve } from 'node:path';

import { type WiredConfig, parseWiredConfig } from '../src/config/schema.ts';
import { SUPPORTED_LOCALES } from '../src/i18n/supportedLocales.ts';

/**
 * Path of the config file to use: WIRED_CONFIG env var if set, else
 * wired.config.json if it exists, else wired.config.example.json. Relative to `root`.
 */
export function configPath(
  root: string,
  env: Readonly<Record<string, string | undefined>>,
  exists: (path: string) => boolean,
): string {
  const fromEnv = env['WIRED_CONFIG'];
  if (fromEnv !== undefined && fromEnv !== '') {
    return resolve(root, fromEnv);
  }
  const deployment = resolve(root, 'wired.config.json');
  if (exists(deployment)) {
    return deployment;
  }
  return resolve(root, 'wired.config.example.json');
}

/**
 * Reads, JSON-parses and validates the file. Throws an Error whose message
 * lists every problem, one per line, prefixed with the file path.
 */
export function loadConfig(path: string, read: (path: string) => string): WiredConfig {
  let json: unknown;
  try {
    json = JSON.parse(read(path));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${path}: invalid JSON: ${reason}`, { cause: error });
  }
  const result = parseWiredConfig(json);
  if (!result.ok) {
    throw new Error(`${path}: invalid config\n${result.error.join('\n')}`);
  }
  const { defaultLocale } = result.value;
  if (
    defaultLocale !== undefined &&
    !SUPPORTED_LOCALES.some(({ code }) => code === defaultLocale)
  ) {
    const codes = SUPPORTED_LOCALES.map(({ code }) => code).join(', ');
    throw new Error(
      `${path}: invalid config\ndefaultLocale: "${defaultLocale}" is not supported; use one of ${codes}`,
    );
  }
  return result.value;
}
