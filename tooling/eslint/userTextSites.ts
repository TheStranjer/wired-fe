/**
 * The AST half of `wired/no-literal-user-text`: given the expression that
 * holds a text (a prop value, a call argument, a property value), the
 * strings it may evaluate to as written, each with the node to report.
 */

import type { Rule } from 'eslint';

import { hasWord } from './userText.ts';

/** The node of ESTree type {@link K}, as ESLint hands it to a rule. */
export type NodeOf<K extends Rule.Node['type']> = Extract<Rule.Node, { type: K }>;

/** Any expression, as ESTree types it. */
export type Expr = NodeOf<'ConditionalExpression'>['test'];

/** A string the rule judges: what it says, whether it holds a word, and the node to report. */
export type Site = { readonly node: Rule.Node; readonly text: string; readonly letters: boolean };

/** The hole marker {@link templateText} writes for each `${…}`. */
export const HOLE = '${}';

/** A template's text with each `${…}` written as {@link HOLE}. */
function templateText(node: Extract<Expr, { type: 'TemplateLiteral' }>): string {
  return node.quasis.map((quasi) => quasi.value.cooked ?? quasi.value.raw).join(HOLE);
}

/** The {@link Site} of a plain {@link text} reported at {@link node}. */
export function textSite(node: unknown, text: string): Site {
  return { node: node as Rule.Node, text, letters: hasWord(text) };
}

/** The strings {@link expr} may evaluate to as written: literals, through `?:`, `??`, `||` and `&&`. */
export function sitesOf(expr: Expr | null | undefined): readonly Site[] {
  if (expr === null || expr === undefined) {
    return [];
  }
  if (expr.type === 'Literal') {
    return typeof expr.value === 'string' ? [textSite(expr, expr.value)] : [];
  }
  if (expr.type === 'TemplateLiteral') {
    const text = templateText(expr);
    return [{ node: expr as Rule.Node, text, letters: hasWord(text.replaceAll(HOLE, ' ')) }];
  }
  if (expr.type === 'ConditionalExpression') {
    return [...sitesOf(expr.consequent), ...sitesOf(expr.alternate)];
  }
  if (expr.type === 'LogicalExpression') {
    return [...sitesOf(expr.left), ...sitesOf(expr.right)];
  }
  return [];
}

/** The strings a function hands back as written: its top-level `return` arguments, or an arrow's expression. */
export function returnedSites(fn: Expr): readonly Site[] {
  if (fn.type === 'ArrowFunctionExpression') {
    return fn.body.type === 'BlockStatement' ? [] : sitesOf(fn.body);
  }
  if (fn.type !== 'FunctionExpression') {
    return [];
  }
  return fn.body.body.flatMap((statement) =>
    statement.type === 'ReturnStatement' ? sitesOf(statement.argument) : [],
  );
}

/** True when {@link property} is keyed by one of {@link names}. */
export function isKeyedBy(property: NodeOf<'Property'>, names: readonly string[]): boolean {
  const { key } = property;
  if (property.computed) {
    return false;
  }
  if (key.type === 'Identifier') {
    return names.includes(key.name);
  }
  return key.type === 'Literal' && typeof key.value === 'string' && names.includes(key.value);
}

/** The message strings of a call's first argument: the string itself, or an object's `message`. */
export function messageSites(
  arg: NodeOf<'CallExpression'>['arguments'][number] | undefined,
): readonly Site[] {
  if (arg?.type !== 'ObjectExpression') {
    return arg === undefined || arg.type === 'SpreadElement' ? [] : sitesOf(arg);
  }
  return arg.properties.flatMap((property) =>
    property.type === 'Property' && isKeyedBy(property as NodeOf<'Property'>, ['message'])
      ? sitesOf(property.value as Expr)
      : [],
  );
}
