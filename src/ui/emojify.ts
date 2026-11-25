/**
 * Custom emoji (WFE-100): `:shortcode:` text in already-sanitized remote
 * HTML replaced by inline images, from the status's own emoji list only.
 * The sanitizer strips every `img`, so the only images this module puts on
 * the screen are ones it builds itself from the shortcodes the backend
 * shipped with the post, never from the hostile markup. Unknown shortcodes
 * and emojis without an https image stay plain text, and text inside
 * `code` and `pre` is never touched.
 */

/** A custom emoji the status names: its shortcode and its image URL. */
export type EmojiRef = {
  /** The shortcode, without the colons around it. */
  readonly shortcode: string;
  /** The URL of the image this emoji shows as. */
  readonly url: string;
};

/** The shape of `:shortcode:` text; global so matchAll finds every one. */
const SHORTCODE = /:[a-zA-Z0-9_]+:/gu;

/** Elements whose text is code: their colons are meant to be read literally. */
const CODE_TAGS: readonly string[] = ['CODE', 'PRE'];

/** Whether `url` parses as an https: URL; junk and other schemes do not. */
export function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/** The status's emoji images that may render, keyed by `:shortcode:` text. */
function httpsImages(emojis: readonly EmojiRef[]): Map<string, string> {
  const images = new Map<string, string>();
  for (const { shortcode, url } of emojis) {
    if (isHttps(url)) {
      images.set(`:${shortcode}:`, url);
    }
  }
  return images;
}

/** Collects into {@link found} every text node under {@link node} that is
 * not inside a `code` or `pre` element. */
function emojiTexts(node: Node, found: Text[]): void {
  for (const child of Array.from(node.childNodes)) {
    if (child instanceof Text) {
      found.push(child);
    } else if (child instanceof Element && !CODE_TAGS.includes(child.tagName)) {
      emojiTexts(child, found);
    }
  }
}

/** The inline image for one known `:shortcode:`; unknown codes stay text. */
function emojiImage(code: string, images: Map<string, string>, doc: Document): Node {
  const url = images.get(code);
  if (url === undefined) {
    return doc.createTextNode(code);
  }
  const img = doc.createElement('img');
  img.setAttribute('class', 'emoji');
  img.setAttribute('src', url);
  img.setAttribute('alt', code);
  img.setAttribute('title', code);
  img.setAttribute('draggable', 'false');
  return img;
}

/** One text node's replacement: literal runs alternating with emoji images. */
function textFragment(data: string, images: Map<string, string>, doc: Document): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  let last = 0;
  for (const match of data.matchAll(SHORTCODE)) {
    fragment.append(data.slice(last, match.index));
    fragment.append(emojiImage(match[0], images, doc));
    last = match.index + match[0].length;
  }
  fragment.append(data.slice(last));
  return fragment;
}

/**
 * Returns sanitized HTML with every `:shortcode:` text that names one of
 * {@link emojis} replaced by an inline `<img class="emoji">`; unknown
 * shortcodes and emojis without an https URL stay as written, `code` and
 * `pre` text is left alone, and attributes are never touched.
 */
export function emojify(sanitizedHtml: string, emojis: readonly EmojiRef[]): string {
  const images = httpsImages(emojis);
  if (images.size === 0) {
    return sanitizedHtml;
  }
  const doc = new DOMParser().parseFromString(sanitizedHtml, 'text/html');
  const texts: Text[] = [];
  emojiTexts(doc.body, texts);
  for (const text of texts) {
    text.replaceWith(textFragment(text.data, images, doc));
  }
  return doc.body.innerHTML;
}
