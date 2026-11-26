/**
 * `wired/no-literal-user-text`: user-facing text lives in
 * `src/i18n/locales/en.json` and reaches the screen through `t()` (decision
 * 19, AGENTS.md "Translated text"). The rule flags a string or template
 * literal that holds letters where it would be shown: JSX text, the
 * `aria-label`, `aria-description`, `title`, `placeholder`, `alt` and `label`
 * props, the message of `fail()`, `err()` and `context.print()`, and the
 * `summary` and `usage` of a command definition. Key chords, usage made only
 * of command syntax and the entries of `userTextAllowlist.ts` pass.
 */

import type { Rule } from 'eslint';

import { isAllowlisted, isCommandSyntax, isKeyChord } from './userText.ts';
import {
  HOLE,
  type Expr,
  type NodeOf,
  type Site,
  isKeyedBy,
  messageSites,
  returnedSites,
  sitesOf,
  textSite,
} from './userTextSites.ts';

/** The JSX shapes ESTree has no types for, as far as the rule reads them. */
type JsxChild = { readonly type: string; readonly value?: string; readonly expression?: Expr };
type JsxParent = { readonly children: readonly JsxChild[] };
type JsxValue = { readonly type: string; readonly value?: unknown; readonly expression?: Expr };
type JsxAttribute = { readonly name: { readonly name?: unknown }; readonly value: JsxValue | null };

/** The props whose value a reader sees or hears. */
const TEXT_PROPS: ReadonlySet<unknown> = new Set([
  'aria-label',
  'aria-description',
  'title',
  'placeholder',
  'alt',
  'label',
]);

/** The calls whose first argument is a message for the reader. */
const MESSAGE_CALLS: readonly string[] = ['fail', 'err'];

/** The name of the message call: `fail` or `err`, or `print` for `context.print`. */
function calleeName(call: NodeOf<'CallExpression'>): string | undefined {
  const { callee } = call;
  if (callee.type === 'Identifier') {
    return MESSAGE_CALLS.includes(callee.name) ? callee.name : undefined;
  }
  const printsToContext =
    callee.type === 'MemberExpression' &&
    callee.object.type === 'Identifier' &&
    callee.object.name === 'context' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'print';
  return printsToContext ? 'print' : undefined;
}

/** Whether a site {@link where} may stay a literal in the file {@link filename}. */
function isAllowed(site: Site, where: string, filename: string): boolean {
  return (
    !site.letters ||
    isKeyChord(site.text) ||
    (where === 'usage' && isCommandSyntax(site.text.replaceAll(HOLE, 'x'))) ||
    isAllowlisted(filename, site.text)
  );
}

/** The strings a JSX child shows: its text, or the literals of its `{…}`. */
function childSites(child: JsxChild): readonly Site[] {
  if (child.type === 'JSXText') {
    return [textSite(child, (child.value ?? '').trim().replaceAll(/\s+/gu, ' '))];
  }
  return child.type === 'JSXExpressionContainer' ? sitesOf(child.expression) : [];
}

/** The strings a JSX prop shows: a string value, or the literals of its `{…}`. */
function propSites(value: JsxValue | null): readonly Site[] {
  if (value === null) {
    return [];
  }
  if (value.type === 'JSXExpressionContainer') {
    return sitesOf(value.expression);
  }
  return typeof value.value === 'string' ? [textSite(value, value.value)] : [];
}

/** The rule module (registered as `wired/no-literal-user-text` in eslint.config.js). */
export const noLiteralUserText: Rule.RuleModule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      literal: 'User-facing text in {{where}} must come from t() and src/i18n/locales/en.json.',
    },
  },
  create(context): Rule.RuleListener {
    const check = (sites: readonly Site[], where: string): void => {
      for (const site of sites.filter((one) => !isAllowed(one, where, context.filename))) {
        context.report({ node: site.node, messageId: 'literal', data: { where } });
      }
    };
    const checkChildren = (node: unknown): void => {
      check((node as JsxParent).children.flatMap(childSites), 'JSX text');
    };
    return {
      JSXElement: checkChildren,
      JSXFragment: checkChildren,
      JSXAttribute(node: unknown): void {
        const { name, value } = node as JsxAttribute;
        if (TEXT_PROPS.has(name.name)) {
          check(propSites(value), `the ${String(name.name)} prop`);
        }
      },
      CallExpression(node): void {
        const name = calleeName(node);
        if (name !== undefined) {
          check(messageSites(node.arguments[0]), `${name}()`);
        }
      },
      Property(node): void {
        const where = ['summary', 'usage'].find((key) => isKeyedBy(node, [key]));
        if (where !== undefined) {
          check([...sitesOf(node.value as Expr), ...returnedSites(node.value as Expr)], where);
        }
      },
    };
  },
};
