/**
 * Schema pieces shared by the entity schemas (decision 7): the non-negative
 * counter and the lenient list of strings, each defined once here.
 */

import * as v from 'valibot';

/** A counter: a whole number that is never negative. */
export const CountSchema = v.pipe(v.number(), v.integer(), v.minValue(0));

/** The strings of an unknown value; an absent, foreign or non-array value yields [] and non-strings are dropped. */
export function stringList(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
