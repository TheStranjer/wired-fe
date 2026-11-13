/**
 * Tests for the Field schema: pass-through of a verified profile row and the
 * verified_at default for backends that never send one.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { FieldSchema } from './field';

describe('Field schema', () => {
  it('passes a verified field through unchanged', () => {
    expect(
      v.safeParse(FieldSchema, {
        name: 'Blog',
        value: '<a href="https://lain.example">https://lain.example</a>',
        verified_at: '2026-11-01T12:00:00Z',
      }).output,
    ).toStrictEqual({
      name: 'Blog',
      value: '<a href="https://lain.example">https://lain.example</a>',
      verified_at: '2026-11-01T12:00:00Z',
    });
  });

  it('defaults verified_at to null when it is absent', () => {
    expect(v.safeParse(FieldSchema, { name: 'Pronouns', value: 'she/her' }).output).toStrictEqual({
      name: 'Pronouns',
      value: 'she/her',
      verified_at: null,
    });
  });

  it('keeps an explicit null verified_at', () => {
    expect(
      v.safeParse(FieldSchema, { name: 'Age', value: '4', verified_at: null }).output,
    ).toStrictEqual({ name: 'Age', value: '4', verified_at: null });
  });

  it('fails when value is missing', () => {
    expect(v.safeParse(FieldSchema, { name: 'Blog' }).success).toBe(false);
  });

  it('fails when name is missing', () => {
    expect(v.safeParse(FieldSchema, { value: 'hi' }).success).toBe(false);
  });
});
