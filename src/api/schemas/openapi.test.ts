/**
 * Cross-checks the recorded Wired OpenAPI document (`src/api/fixtures/
 * wired-openapi.json`, decision 7) against the WFE entity schemas: for each
 * of the eight entities, the component schema's `example` in the snapshot —
 * or, failing that, the first response example whose media type references
 * the component — must pass `v.safeParse` against the WFE schema it
 * describes. The WBE-227 document is generated from the route inventory
 * alone and carries no `components.schemas` yet, so every entity currently
 * reports its example missing: those tests skip, the names are written to
 * the test output once, and nothing fails. A present example that does not
 * parse fails, and the received value lists the dot path of every issue.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { AccountSchema } from './account';
import { ContextSchema } from './context';
import { ConversationSchema } from './conversation';
import { MediaAttachmentSchema } from './mediaAttachment';
import { NotificationSchema } from './notification';
import { PollSchema } from './poll';
import { RelationshipSchema } from './relationship';
import { StatusSchema } from './status';
import wiredOpenapi from '../fixtures/wired-openapi.json';

/** A JSON object as the traversal reads it: unknown values keyed by name. */
type UnknownRecord = Record<string, unknown>;

/** The eight entities whose WFE schemas the snapshot is checked against. */
const ENTITY_NAMES = [
  'Account',
  'Status',
  'Notification',
  'Relationship',
  'Poll',
  'MediaAttachment',
  'Conversation',
  'Context',
] as const;

/** The HTTP methods a path item carries operations under. */
const OPERATION_METHODS = ['delete', 'get', 'patch', 'post', 'put'] as const;

/** The parsed snapshot, widened so the traversal keeps every value `unknown`. */
const DOCUMENT: UnknownRecord = asRecord(wiredOpenapi) ?? {};

/** Narrows `value` to a JSON object, or `undefined` for anything else. */
function asRecord(value: unknown): UnknownRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

/** The defined entries of `candidates`, typed. */
function defined<T>(candidates: readonly (T | undefined)[]): T[] {
  return candidates.filter((candidate): candidate is T => candidate !== undefined);
}

/** Every object value of `container`'s own properties, in document order. */
function recordsOf(container: UnknownRecord | undefined): UnknownRecord[] {
  return defined(Object.values(container ?? {}).map(asRecord));
}

/** Every operation object the document's `paths` holds, in document order. */
function operations(): UnknownRecord[] {
  const methods = (item: UnknownRecord): (UnknownRecord | undefined)[] =>
    OPERATION_METHODS.map((method) => asRecord(item[method]));
  return recordsOf(asRecord(DOCUMENT['paths'])).flatMap((item) => defined(methods(item)));
}

/** Every media type object of an operation's responses: `200` → `content` → type. */
function mediaTypesOf(operation: UnknownRecord): UnknownRecord[] {
  const responses = recordsOf(asRecord(operation['responses']));
  return responses.flatMap((response) => recordsOf(asRecord(response['content'])));
}

/** The example a media type carries: its `example`, or the first `examples` value. */
function exampleOf(media: UnknownRecord): unknown {
  if (media['example'] !== undefined) {
    return media['example'];
  }
  const [first] = recordsOf(asRecord(media['examples']));
  return first?.['value'];
}

/** The example `components.schemas[<name>]` declares itself, if any. */
function componentExample(name: string): unknown {
  const schemas = asRecord(asRecord(DOCUMENT['components'])?.['schemas']);
  return asRecord(schemas?.[name])?.['example'];
}

/** The first example in `paths` whose media-type schema references `name`. */
function responseExample(name: string): unknown {
  const reference = `#/components/schemas/${name}`;
  const examples = operations()
    .flatMap(mediaTypesOf)
    .filter((media) => asRecord(media['schema'])?.['$ref'] === reference)
    .map(exampleOf);
  return defined(examples)[0];
}

/** The example the snapshot carries for `name`: the component's own, else a response's. */
function exampleFor(name: string): unknown {
  return componentExample(name) ?? responseExample(name);
}

/** `message: dot-path` for every valibot issue, `(root)` where a path is absent. */
function issueSummaries(issues: readonly v.BaseIssue<unknown>[]): string[] {
  return issues.map((issue) => `${issue.message}: ${v.getDotPath(issue) ?? '(root)'}`);
}

/** `true` when the example parses, else the issues' summaries — the expected value. */
function parseReport(schema: v.GenericSchema<unknown, unknown>, example: unknown): true | string {
  const result = v.safeParse(schema, example);
  if (result.success) {
    return true;
  }
  return issueSummaries(result.issues).join('; ');
}

/** Whether the snapshot carries no example at all for the entity `name`. */
function exampleMissing(name: string): boolean {
  return exampleFor(name) === undefined;
}

const missingExamples = ENTITY_NAMES.filter(exampleMissing);

/** The Vitest worker's stdout, which the app layering leaves untyped. */
const stdout = (globalThis as { process?: { stdout?: { write: (chunk: string) => void } } }).process
  ?.stdout;

if (missingExamples.length > 0 && stdout !== undefined) {
  stdout.write(
    `the Wired OpenAPI snapshot carries no example for: ${missingExamples.join(', ')}\n`,
  );
}

/** Routes wired-be removed. */
const REMOVED_PATHS = [
  '/api/v1/pleroma/preferred_frontend',
  '/api/v1/pleroma/preferred_frontend/available',
  '/api/openapi',
  '/api/pleroma/frontend_configurations',
  '/frontend_switcher',
  '/embed/{id}',
  '/notice/{id}/embed_player',
  '/ostatus_subscribe',
  '/main/ostatus',
  '/authorize_interaction',
  '/manifest.json',
  '/user_exists',
  '/check_password',
  '/oauth/mfa',
  '/oauth/mfa/verify',
  '/tags/{tag}',
  '/mailer/unsubscribe/{token}',
  '/instance/{name}.html',
] as const;

describe('the frozen Wired OpenAPI snapshot paths', () => {
  const paths = Object.keys(asRecord(DOCUMENT['paths']) ?? {});

  it.each(REMOVED_PATHS)('does not list the removed path %s', (path) => {
    expect(paths).toContain('/health');
    expect(paths).not.toContain(path);
  });

  it('lists no feed path', () => {
    expect(paths.filter((path) => /\/feed(\/|$)/.test(path))).toStrictEqual([]);
  });
});

describe('the Wired OpenAPI snapshot against the WFE entity schemas', () => {
  it.skipIf(exampleMissing('Account'))('the Account example parses', () => {
    expect(parseReport(AccountSchema, exampleFor('Account'))).toBe(true);
  });

  it.skipIf(exampleMissing('Status'))('the Status example parses', () => {
    expect(parseReport(StatusSchema, exampleFor('Status'))).toBe(true);
  });

  it.skipIf(exampleMissing('Notification'))('the Notification example parses', () => {
    expect(parseReport(NotificationSchema, exampleFor('Notification'))).toBe(true);
  });

  it.skipIf(exampleMissing('Relationship'))('the Relationship example parses', () => {
    expect(parseReport(RelationshipSchema, exampleFor('Relationship'))).toBe(true);
  });

  it.skipIf(exampleMissing('Poll'))('the Poll example parses', () => {
    expect(parseReport(PollSchema, exampleFor('Poll'))).toBe(true);
  });

  it.skipIf(exampleMissing('MediaAttachment'))('the MediaAttachment example parses', () => {
    expect(parseReport(MediaAttachmentSchema, exampleFor('MediaAttachment'))).toBe(true);
  });

  it.skipIf(exampleMissing('Conversation'))('the Conversation example parses', () => {
    expect(parseReport(ConversationSchema, exampleFor('Conversation'))).toBe(true);
  });

  it.skipIf(exampleMissing('Context'))('the Context example parses', () => {
    expect(parseReport(ContextSchema, exampleFor('Context'))).toBe(true);
  });
});
