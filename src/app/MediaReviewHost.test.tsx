/**
 * Tests for the host of the media review (WFE-290): asking through the seam
 * opens the `Describe media` dialog over the app and waits; Submit answers with
 * the descriptions and Cancel with null, and either way what was typed is kept
 * on the lines of the box that was asked about.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { MediaReviewHost } from './MediaReviewHost';
import { initialAppState } from '../state/appState';
import { COMMAND_LINE_MEDIA, composerMediaOf } from '../state/composerMedia';
import type { ComposerMedia } from '../state/draft';
import { AppStateProvider, useAppState } from '../state/StateContext';
import { useReviewMedia } from '../views/MediaReviewContext';

/** One ready, undescribed line in the command line's media. */
const LINE: ComposerMedia = {
  key: 'k1',
  name: 'cat.png',
  status: 'ready',
  mediaId: '7',
  previewUrl: null,
  description: '',
  error: '',
};

/** A button that asks for a review and prints how it was answered, next to the stored description. */
function Asker(): JSX.Element {
  const review = useReviewMedia();
  const stored = composerMediaOf(useAppState(), COMMAND_LINE_MEDIA)[0]?.description;
  const [answer, setAnswer] = useState('waiting');
  return (
    <>
      <button
        onClick={() => {
          void review(COMMAND_LINE_MEDIA, [LINE]).then((typed) => {
            setAnswer(typed === null ? 'cancelled' : `submitted ${typed.get('k1') ?? '?'}`);
          });
        }}
        type="button"
      >
        ask
      </button>
      <output>{`answer: ${answer}`}</output>
      <output>{`stored: ${stored ?? '?'}`}</output>
    </>
  );
}

/** The host over the app state holding {@link LINE}, with the asker inside. */
function renderHost(): void {
  render(
    <AppStateProvider
      initial={{ ...initialAppState(), composerMedia: new Map([[COMMAND_LINE_MEDIA, [LINE]]]) }}
    >
      <MediaReviewHost>
        <Asker />
      </MediaReviewHost>
    </AppStateProvider>,
  );
}

/** Ask, and type {@link text} into the description in the dialog that opens. */
async function askAndType(text: string): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'ask' }));
  const field = await screen.findByRole('textbox', { name: 'Description for cat.png' });
  fireEvent.change(field, { target: { value: text } });
}

describe(MediaReviewHost, () => {
  it('shows no dialog until a review is asked for', () => {
    renderHost();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'ask' })).toBeInTheDocument();
  });

  it('answers Submit with the descriptions and keeps them on the lines', async () => {
    renderHost();

    await askAndType('a grey cat');

    expect(screen.getByText('answer: waiting')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await screen.findByText('answer: submitted a grey cat');

    expect(screen.getByText('stored: a grey cat')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('answers Cancel with null and still keeps what was typed', async () => {
    renderHost();

    await askAndType('a grey cat');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await screen.findByText('answer: cancelled');

    expect(screen.getByText('stored: a grey cat')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
