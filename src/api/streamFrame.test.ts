/**
 * Tests for the frame decoder: each event kind arrives with its payload parsed
 * by the REST schemas, and everything that is not a usable frame degrades to
 * `other` or to null without throwing.
 */
import { describe, expect, it } from 'vitest';

import { decodeFrame } from './streamFrame';
import { notification, status } from '../test/fixtures';

/** One frame as the instance writes it: the payload is a JSON string. */
function frame(event: string, payload: unknown, stream: readonly string[] = ['user']): string {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);

  return JSON.stringify({ stream, event, payload: body });
}

describe(decodeFrame, () => {
  it('decodes an update into a status', () => {
    const post = status('1');

    expect(decodeFrame(frame('update', post, ['public:local']))).toStrictEqual({
      kind: 'update',
      stream: ['public:local'],
      status: post,
    });
  });

  it('decodes a status.update into an edit', () => {
    const post = status('2');

    expect(decodeFrame(frame('status.update', post))).toStrictEqual({
      kind: 'statusUpdate',
      stream: ['user'],
      status: post,
    });
  });

  it('decodes a delete into the bare id', () => {
    expect(decodeFrame(frame('delete', '42'))).toStrictEqual({
      kind: 'delete',
      stream: ['user'],
      id: '42',
    });
  });

  it('decodes a notification', () => {
    const note = notification('7', status('3'));

    expect(decodeFrame(frame('notification', note))).toStrictEqual({
      kind: 'notification',
      stream: ['user'],
      notification: note,
    });
  });

  it('reports an event it does not model by name', () => {
    expect(decodeFrame(frame('filters_changed', ''))).toStrictEqual({
      kind: 'other',
      event: 'filters_changed',
    });
  });

  it('reports a modelled event with a broken payload as other', () => {
    expect(decodeFrame(frame('update', '{nope'))).toStrictEqual({ kind: 'other', event: 'update' });
    expect(decodeFrame(frame('notification', { id: 1 }))).toStrictEqual({
      kind: 'other',
      event: 'notification',
    });
  });

  it('reports a delete without a payload as other', () => {
    expect(decodeFrame(JSON.stringify({ stream: ['user'], event: 'delete' }))).toStrictEqual({
      kind: 'other',
      event: 'delete',
    });
  });

  it('defaults a missing stream list to empty', () => {
    expect(decodeFrame(JSON.stringify({ event: 'delete', payload: '9' }))).toStrictEqual({
      kind: 'delete',
      stream: [],
      id: '9',
    });
  });

  it('answers null for text that is no frame', () => {
    expect(decodeFrame('not json')).toBeNull();
    expect(decodeFrame('{"stream":["user"]}')).toBeNull();
    expect(decodeFrame('42')).toBeNull();
  });
});
