/**
 * Completion of post labels inside a post's text (WFE-302): a word typed with
 * `[` (`[a3`) completes to the link of the post that label names — its `url`,
 * else its `uri` — the thing worth putting in text that others read. A bare
 * `a3` is never completed: it is too much like an ordinary word. The labels
 * come from the {@link LabelSource}s the text box is given, each window's
 * newest line first, and each row is described as `[a3] title <@author>
 * words`: the window's title only where it is given, since a box that has a
 * window of its own (the thread and DM inputs) needs no title to tell its
 * labels apart. A post named by two labels is offered once, under the first.
 */

import { once } from './completionKit';
import type { CompletionProvider } from './completionProviders';
import { BRACKET_WORD, labelledIn, postWords, prefixOf } from './postLabels';
import type { Status } from '../api/schemas/status';
import type { Buffer } from '../state/buffer';

/** The most links one word may offer. */
const MAX_LINKS = 50;

/** One window whose labels a text box may name: its scrollback and, to tell windows apart, its title. */
export type LabelSource = {
  readonly title: string | null;
  readonly buffer: Buffer;
};

/** One labelled post as the text offers it. */
type Link = {
  readonly label: string;
  readonly url: string;
  readonly title: string | null;
  readonly status: Status;
};

/** The link a post is written as: its web page, or its canonical id when it has none. */
function linkOf(status: Status): string {
  const original = status.reblog ?? status;
  return original.url ?? original.uri;
}

/** Every labelled post of {@link sources}, in their order, each link once. */
function linksOf(sources: readonly LabelSource[]): readonly Link[] {
  const links = new Map<string, Link>();
  for (const { title, buffer } of sources) {
    for (const { label, status } of labelledIn(buffer)) {
      const url = linkOf(status);
      if (!links.has(url)) {
        links.set(url, { label, url, title, status });
      }
    }
  }
  return [...links.values()];
}

/** The line a row says about {@link link}: the window's title, then the post's words. */
function describing(link: Link): string {
  const words = postWords(link.status);
  return link.title === null ? words : `${link.title} ${words}`;
}

/** The provider for post labels in text: `[a3` completes to the link of the post {@link sources} label `a3`. */
export function postLabelProvider(sources: readonly LabelSource[]): CompletionProvider {
  const links = once(() => linksOf(sources));
  return {
    accepts: (word) => BRACKET_WORD.test(word),
    candidates: (word) => {
      const prefix = prefixOf(word);
      return links()
        .filter((link) => link.label.startsWith(prefix))
        .slice(0, MAX_LINKS)
        .map((link) => link.url);
    },
    describe: (candidate) => {
      const found = links().find((link) => link.url === candidate);
      return found === undefined
        ? undefined
        : { word: candidate, label: `[${found.label}]`, description: describing(found) };
    },
  };
}
