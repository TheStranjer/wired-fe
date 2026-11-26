/**
 * ICU formatters for catalog messages (decision 19): a message parsed into a
 * formatter, and the comparison that decides whether a translation may be
 * used — it must name exactly the arguments the English source names, else
 * it is stale (the source changed after the translation was made).
 */

import { IntlMessageFormat } from 'intl-messageformat';

/** The parsed form of a message, as `getAst` returns it. */
type Ast = ReturnType<IntlMessageFormat['getAst']>;

/** ICU's `TYPE.literal`: the one element kind that carries text, not an argument name. */
const LITERAL = 0;

/** The argument names {@link ast} uses, including those inside plural, select and tag branches. */
function argumentNames(ast: Ast): ReadonlySet<string> {
  const names = new Set<string>();
  for (const element of ast) {
    const kind: number = element.type;
    if ('value' in element && kind !== LITERAL) {
      names.add(element.value);
    }
    const nested = [
      ...('options' in element ? Object.values(element.options).map((option) => option.value) : []),
      ...('children' in element ? [element.children] : []),
    ];
    for (const inner of nested) {
      argumentNames(inner).forEach((name) => names.add(name));
    }
  }
  return names;
}

/** The formatter of {@link message} for {@link locale}; null when it does not parse. */
export function parseMessage(message: string, locale: string): IntlMessageFormat | null {
  try {
    return new IntlMessageFormat(message, locale);
  } catch {
    return null;
  }
}

/** Whether the two messages use the same argument names. */
export function sameArguments(a: IntlMessageFormat, b: IntlMessageFormat): boolean {
  const names = argumentNames(a.getAst());
  const others = argumentNames(b.getAst());
  return names.size === others.size && [...names].every((name) => others.has(name));
}
