/**
 * The pending-media fixtures shared by the app's attachment tests (WFE-126):
 * the fake Wired media endpoint uploads run against, the fireEvent dance that
 * answers the hidden file input with a chosen list, and the reader of the
 * lines the uploads printed into the active window. What an upload carries is
 * asserted on the state layer's own tests, in the node environment:
 * jsdom-built multipart streams close prematurely when MSW consumes them.
 */
import { fireEvent } from '@testing-library/react';
import { HttpResponse, http } from 'msw';

import { server } from './server';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import type { AppState } from '../state/appState';
import type { SystemLineData } from '../state/buffer';
import { bufferFor } from '../state/selectors';
import { STATUS_WINDOW_ID } from '../windows/model';

/** The instance every attachment-test session talks to. */
export const ORIGIN = 'https://wired.example';

/** The one account those sessions sign in with. */
export const ACCOUNT: StoredAccount = {
  key: accountKey(ORIGIN, '1'),
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'not-a-real-token',
  refreshToken: null,
  expiresAt: null,
};

/** What the fake instance answers a finished upload with, under `id`. */
export function ready(id: string): Record<string, unknown> {
  return {
    id,
    type: 'image',
    url: `${ORIGIN}/media/${id}.png`,
    preview_url: null,
    remote_url: null,
    description: null,
    blurhash: null,
  };
}

/** The hidden file input a test rendered. */
export function fileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('the test rendered no file input');
  }
  return input;
}

/** Choose {@link files} in the dialog and report it the way the browser does. */
export function choose(input: HTMLInputElement, files: readonly File[]): void {
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  fireEvent.change(input);
}

/** The text of every line printed into the active window, oldest first. */
export function lines(state: AppState): readonly string[] {
  return bufferFor(state, STATUS_WINDOW_ID)
    .lines.filter((line): line is SystemLineData => line.kind === 'system')
    .map((line) => line.text);
}

/** One image file, named after {@link name}. */
export function picture(name: string): File {
  return new File(['pixel'], name, { type: 'image/png' });
}

/** Answer every upload with a ready attachment and count the requests. */
export function servingUploads(): { readonly requests: () => number } {
  let requests = 0;
  server.use(
    http.post(`${ORIGIN}/api/v2/media`, () => {
      requests += 1;
      return HttpResponse.json(ready(String(requests)));
    }),
  );
  return { requests: () => requests };
}
