/**
 * Tests for the NodeInfo schemas: the rel-and-href entries the discovery
 * answer keeps, and from a 2.x document the lowercased software name, the
 * version and registrations defaults, and the extraction of the metadata
 * features array (non-strings dropped) and nodeName. Only a missing `version`
 * or `software` fails the document.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { type NodeInfo, type NodeInfoLinks, NodeInfoLinksSchema, NodeInfoSchema } from './nodeinfo';

const REL_21 = 'http://nodeinfo.diaspora.software/ns/schema/2.1';
const REL_20 = 'http://nodeinfo.diaspora.software/ns/schema/2.0';

/** Parses {@link input} with the NodeInfo schema, throwing on failure. */
function parse(input: unknown): NodeInfo {
  const result = v.safeParse(NodeInfoSchema, input);
  if (!result.success) {
    throw new Error(`unexpected parse failure: ${JSON.stringify(result.issues)}`);
  }
  return result.output;
}

/** Parses {@link input} with the link-list schema, throwing on failure. */
function parseLinks(input: unknown): NodeInfoLinks {
  const result = v.safeParse(NodeInfoLinksSchema, input);
  if (!result.success) {
    throw new Error(`unexpected parse failure: ${JSON.stringify(result.issues)}`);
  }
  return result.output;
}

describe('NodeInfoLinks schema', () => {
  it('keeps rel and href of every link and drops the rest', () => {
    const parsed = parseLinks({
      links: [
        { rel: REL_20, href: 'https://wired.example/nodeinfo/2.0' },
        { rel: REL_21, href: 'https://wired.example/nodeinfo/2.1', auth: { type: 'basic' } },
      ],
    });

    expect(parsed.links).toStrictEqual([
      { rel: REL_20, href: 'https://wired.example/nodeinfo/2.0' },
      { rel: REL_21, href: 'https://wired.example/nodeinfo/2.1' },
    ]);
  });

  it('fails when links or a required link key is missing', () => {
    expect(v.safeParse(NodeInfoLinksSchema, {}).success).toBe(false);
    expect(v.safeParse(NodeInfoLinksSchema, { links: [{ rel: REL_21 }] }).success).toBe(false);
    expect(v.safeParse(NodeInfoLinksSchema, 42).success).toBe(false);
  });
});

describe('NodeInfo schema', () => {
  it('reads the features and the node name from a Wired-style document', () => {
    const output = parse({
      version: '2.1',
      software: { name: 'wired', version: '0.4.0', platform: null },
      openRegistrations: true,
      services: { inbound: ['atom'], outbound: ['activitypub'] },
      protocols: ['activitypub'],
      metadata: {
        features: ['pleroma_api', 'mastodon_api', 'emoji_reactions'],
        nodeName: 'Wired example',
      },
      usage: { users: { total: 3 } },
      nodes: [],
    });

    expect(output).toStrictEqual({
      version: '2.1',
      software: { name: 'wired', version: '0.4.0' },
      openRegistrations: true,
      features: ['pleroma_api', 'mastodon_api', 'emoji_reactions'],
      nodeName: 'Wired example',
    });
  });

  it('lowercases the name and empties the features of a Mastodon document', () => {
    const output = parse({
      version: '2.0',
      software: { name: 'Mastodon', version: '4.3.0' },
      openRegistrations: false,
      metadata: null,
    });

    expect(output).toStrictEqual({
      version: '2.0',
      software: { name: 'mastodon', version: '4.3.0' },
      openRegistrations: false,
      features: [],
      nodeName: null,
    });
  });

  it('keeps only the strings of a mixed features array', () => {
    const output = parse({
      version: '2.1',
      software: { name: 'Akkoma', version: '3.15.0' },
      metadata: { features: ['chat', 42, null, 'pleroma_api', { a: 1 }], nodeName: 7 },
    });

    expect(output).toStrictEqual({
      version: '2.1',
      software: { name: 'akkoma', version: '3.15.0' },
      openRegistrations: null,
      features: ['chat', 'pleroma_api'],
      nodeName: null,
    });
  });

  it('defaults the optional keys of a bare document', () => {
    expect(parse({ version: '2.0', software: { name: 'wired' } })).toStrictEqual({
      version: '2.0',
      software: { name: 'wired', version: '' },
      openRegistrations: null,
      features: [],
      nodeName: null,
    });
  });

  it('degrades a metadata block that is not an object', () => {
    const output = parse({
      version: '2.1',
      software: { name: 'glitch', version: '4.3' },
      metadata: 'surprise',
    });

    expect(output).toMatchObject({ features: [], nodeName: null });
  });

  it('fails when version or software.name is missing', () => {
    expect(v.safeParse(NodeInfoSchema, { software: { name: 'wired' } }).success).toBe(false);
    expect(v.safeParse(NodeInfoSchema, { version: '2.1' }).success).toBe(false);
    expect(v.safeParse(NodeInfoSchema, { version: '2.1', software: {} }).success).toBe(false);
  });

  it('fails on a non-object input', () => {
    expect(v.safeParse(NodeInfoSchema, 42).success).toBe(false);
  });
});
