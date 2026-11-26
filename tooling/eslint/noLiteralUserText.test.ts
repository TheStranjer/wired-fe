/**
 * Tests for the `wired/no-literal-user-text` rule: every position it reads
 * flags a literal word, and every allowed form (glyphs, a lone letter, key
 * chords, command syntax in a usage, the allowlist) passes.
 */
import { RuleTester } from 'eslint';
import { parser } from 'typescript-eslint';
import { describe, it } from 'vitest';

import { noLiteralUserText } from './noLiteralUserText.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const FILE = 'src/example.tsx';

const tester = new RuleTester({
  languageOptions: {
    parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

/** A case that must pass, in {@link filename}. */
function pass(code: string, filename: string = FILE): { code: string; filename: string } {
  return { code, filename };
}

/** A case that must fail once, naming {@link where}, in {@link filename}. */
function flag(
  code: string,
  where: string,
  filename: string = FILE,
): { code: string; filename: string; errors: { messageId: string; data: { where: string } }[] } {
  return { code, filename, errors: [{ messageId: 'literal', data: { where } }] };
}

tester.run('no-literal-user-text', noLiteralUserText, {
  valid: [
    // JSX text: glyphs, a lone letter, expressions and the allowlist.
    pass('const a = <b>✕</b>;'),
    pass('const a = <b>[x]</b>;'),
    pass('const a = <b>{t("features.home.topic")}</b>;'),
    pass('const a = <b>{count}</b>;'),
    pass('const a = <b>{" "}</b>;'),
    pass('const a = <b>{1}</b>;'),
    pass('const a = <>{`[${clock}]`}</>;'),
    pass('const a = <h1>WIRED</h1>;', 'src/app/App.tsx'),
    pass('const a = (\n  <span>\n    WIRED\n  </span>\n);', 'src/app/AppHeader.tsx'),
    pass('const a = <b>[≡ wired]</b>;', 'src/app/StartMenu.tsx'),
    // Props: no word, translated, other props, valueless.
    pass('const a = <img alt="" />;'),
    pass('const a = <b title="✕" />;'),
    pass('const a = <b title={t("ui.x")} />;'),
    pass('const a = <b className="hello world" data-note="hello there" />;'),
    pass('const a = <b label />;'),
    pass('const a = <b label={5} />;'),
    pass('const a = <b alt={`:${name}:`} />;'),
    pass('const a = <b title="Ctrl+B %" />;'),
    pass('const a = <b title="Ctrl+Shift+K" />;'),
    pass('const a = <b aria-label={name ?? t("ui.x")} />;'),
    // Calls: translated, no message, spread, other receivers, other callees.
    pass('fail(t("commands.not_logged_in"));'),
    pass('fail();'),
    pass('fail(...rest);'),
    pass('fail(`${a}: ${b}`);'),
    pass('err({ kind: "none" });'),
    pass('err({ kind: "error", message: t("api.x") });'),
    pass('err({ ...rest });'),
    pass('context.print("");'),
    pass('context.print(`  ${chord} → ${line}`);'),
    pass('deps.print("Hello world");'),
    pass('context.log("Hello world");'),
    pass('notify("Hello world");'),
    pass('print("Hello world");'),
    pass('context["print"]("Hello world");'),
    pass('err(`${path} does not export ${label}`);', 'src/lib/registry.ts'),
    pass('err(`Duplicate name: /${a} (already used by /${b})`);', 'src/commands/registry.ts'),
    // Command definitions: translated, command syntax, no words.
    pass('const c = { summary: t("x"), usage: "/about" };'),
    pass(
      'const c = { get summary() { return t("x"); }, get usage() { return "/dm <actor> <text>"; } };',
    ),
    pass('const c = { usage: "/float size <w> <h>" };'),
    pass('const c = { usage: "/feed [view] [<a>|<b>]" };'),
    pass('const c = { usage: "/win move|size" };'),
    pass('const c = { usage: "/dm ... | /as" };'),
    pass('const c = { usage: `/${name}` };'),
    pass('const c = { usage: `/set ${prefix}${kind}` };'),
    pass('const c = { usage: "/a [[b] c]" };'),
    pass('const c = { summary: 5, usage: someUsage };'),
    pass('const c = { summary: () => { return "Do a thing"; } };'),
    pass('const c = { summary() { const x = 1; return t("x") + x; } };'),
    pass('const c = { [summary]: "Do a thing" };'),
    pass('const c = { 1: "Do a thing" };'),
    pass('const c = { name: "Do a thing" };'),
  ],
  invalid: [
    // JSX text.
    flag('const a = <p>Hello there</p>;', 'JSX text'),
    flag('const a = <p>\n  Hello there\n</p>;', 'JSX text'),
    flag('const a = <p>{"Hello there"}</p>;', 'JSX text'),
    flag('const a = <p>{`Hello ${name}`}</p>;', 'JSX text'),
    flag('const a = <p>{ok ? "Yes please" : t("x")}</p>;', 'JSX text'),
    flag('const a = <>Hello there</>;', 'JSX text'),
    flag('const a = <h1>WIRED</h1>;', 'JSX text', 'src/app/Other.tsx'),
    flag('const a = <b>[≡ wired]</b>;', 'JSX text', 'src/app/Other.tsx'),
    // Props.
    flag('const a = <b aria-label="Close it" />;', 'the aria-label prop'),
    flag('const a = <b aria-description="Close it" />;', 'the aria-description prop'),
    flag('const a = <b title="Close it" />;', 'the title prop'),
    flag('const a = <b placeholder="Type here" />;', 'the placeholder prop'),
    flag('const a = <b alt="A cat" />;', 'the alt prop'),
    flag('const a = <b label="Close it" />;', 'the label prop'),
    flag('const a = <b label={"Close it"} />;', 'the label prop'),
    flag('const a = <b label={`Close ${x}`} />;', 'the label prop'),
    flag('const a = <b label={win?.title ?? "thread"} />;', 'the label prop'),
    flag('const a = <b title={ok ? "Close it" : t("x")} />;', 'the title prop'),
    flag('const a = <b title="Ctrl+B and more" />;', 'the title prop'),
    // Messages of fail(), err() and context.print().
    flag('fail("Not allowed");', 'fail()'),
    flag('fail(`Not allowed: ${why}`);', 'fail()'),
    flag('err("Not allowed");', 'err()'),
    flag('err({ kind: "error", message: "Not allowed" });', 'err()'),
    flag('err({ kind: "error", "message": `Not ${x}` });', 'err()'),
    flag('context.print("Hello world");', 'print()'),
    flag('context.print(`theme = ${name}`);', 'print()'),
    flag('context.print(ok ? t("x") : "Hello world");', 'print()'),
    flag('err(`${path} does not export ${label}`);', 'err()', 'src/lib/other.ts'),
    // Command definitions.
    flag('const c = { summary: "Do a thing" };', 'summary'),
    flag('const c = { "summary": `Do ${a} thing` };', 'summary'),
    flag('const c = { get summary() { return "Do a thing"; } };', 'summary'),
    flag('const c = { summary: () => "Do a thing" };', 'summary'),
    flag('const c = { summary() { return "Do a thing"; } };', 'summary'),
    flag('const c = { usage: "Use it like this" };', 'usage'),
    flag('const c = { usage: "/foo bar baz qux" };', 'usage'),
    flag('const c = { usage: "/foo bar|baz|qux" };', 'usage'),
    flag('const c = { usage: "/Foo" };', 'usage'),
    flag('const c = { get usage() { return "Use it like this"; } };', 'usage'),
  ],
});
