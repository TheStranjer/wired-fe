/**
 * Tests that the composer's own text follows the language (decision 19,
 * WFE-321): the form, the poll editor, the audience select, the post text's
 * suggestion list and the attachment lines read the fake language's messages
 * and not English. The values the audience select sends stay protocol words.
 */
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ComposerForm } from './ComposerForm';
import { MediaLines } from './MediaLines';
import { PollSection } from './PollSection';
import { I18nProvider } from '../i18n/I18nProvider';
import { failedPatch, uploadingMedia } from '../state/composerMedia';
import type { DraftPoll } from '../state/pollEditor';
import { installFakeLocale } from '../test/i18n';

/** The poll of an open editor. */
const POLL: DraftPoll = {
  options: ['', ''],
  expiresIn: 86_400,
  multiple: false,
  hideTotals: false,
};

/** A language that names every composer string in capitals. */
const FAKE = {
  views: {
    attachments: {
      description: 'DESC {name}',
      failed: 'FAILED {error}',
      ready: 'READY',
      remove: 'DROP {name}',
      uploading: 'UPLOADING',
    },
    composer: {
      content_warning: 'WARNING',
      post_suggestions: 'SUGGESTIONS',
      post_text: 'TEXT',
      send: 'SEND',
    },
    media: {
      attach: 'ATTACH',
      attach_button: 'ATTACH BUTTON',
      attachments: 'FILES',
      files: 'FILE INPUT',
    },
    poll: {
      media_conflict: 'NO BOTH',
      add_option: 'ADD',
      duration: 'RUN',
      hide_totals: 'HIDE',
      multiple_choice: 'MULTI',
      option: 'CHOICE {number}',
      remove_option: 'DROP CHOICE {number}',
      toggle: 'POLL',
    },
    visibility: { direct: 'DM', label: 'AUDIENCE', public: 'EVERYONE' },
  },
};

/** The form over a poll, two files and a suggestion list. */
function show(): void {
  const failed = { ...uploadingMedia('b', 'dog.png'), ...failedPatch('too big') };
  const ready = { ...uploadingMedia('c', 'bird.png'), status: 'ready' as const };
  render(
    <I18nProvider>
      <ComposerForm
        allowLocal={false}
        attachments={
          <MediaLines
            items={[uploadingMedia('a', 'cat.png'), failed, ready]}
            onDescribe={vi.fn()}
            onFiles={vi.fn()}
            onRemove={vi.fn()}
          />
        }
        completion={{
          ref: { current: null },
          onKeyDown: vi.fn(),
          onCaret: vi.fn(),
          listId: 'list',
          rows: [{ label: '@a', description: '', pick: vi.fn() }],
          active: -1,
        }}
        error={null}
        fields={{ text: 'hi', spoiler: '', visibility: 'public', poll: POLL }}
        maxCharacters={500}
        onChange={vi.fn()}
        onSend={vi.fn()}
        pollLimits={{
          maxOptions: 4,
          maxCharactersPerOption: 50,
          minExpiration: 300,
          maxExpiration: 604_800,
        }}
        sending={false}
      />
    </I18nProvider>,
  );
}

describe('the composer in another language', () => {
  it('names the form, the audience and the poll toggle in it', () => {
    act(() => {
      installFakeLocale(FAKE);
    });
    show();

    expect(screen.getByRole('textbox', { name: 'TEXT' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'WARNING' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SEND' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'POLL' })).toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: 'SUGGESTIONS' })).toBeInTheDocument();
  });

  it('shows the audience by its label and sends the protocol word', () => {
    act(() => {
      installFakeLocale(FAKE);
    });
    show();

    const audience = screen.getByRole('combobox', { name: 'AUDIENCE' });

    expect(audience).toHaveValue('public');
    expect(screen.getByRole('option', { name: 'EVERYONE' })).toHaveValue('public');
    expect(screen.getByRole('option', { name: 'DM' })).toHaveValue('direct');
  });

  it('names the poll editor in it', () => {
    act(() => {
      installFakeLocale(FAKE);
    });
    show();

    expect(screen.getByRole('textbox', { name: 'CHOICE 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'DROP CHOICE 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ADD' })).toBeInTheDocument();
  });

  it('names the poll settings in it', () => {
    act(() => {
      installFakeLocale(FAKE);
    });
    show();

    expect(screen.getByRole('combobox', { name: 'RUN' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'MULTI' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'HIDE' })).toBeInTheDocument();
  });

  it('names the attach button and the attachment lines in it', () => {
    act(() => {
      installFakeLocale(FAKE);
    });
    show();

    expect(screen.getByRole('button', { name: 'ATTACH' })).toHaveTextContent('ATTACH BUTTON');
    expect(screen.getByRole('list', { name: 'FILES' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'DESC cat.png' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'DROP dog.png' })).toBeInTheDocument();
  });

  it('words the upload state of each attachment in it', () => {
    act(() => {
      installFakeLocale(FAKE);
    });
    show();

    expect(screen.getByText('UPLOADING')).toBeInTheDocument();
    expect(screen.getByText('READY')).toBeInTheDocument();
    expect(screen.getByText('FAILED too big')).toBeInTheDocument();
  });

  it('says in it why the poll toggle is off while media is attached', () => {
    act(() => {
      installFakeLocale(FAKE);
    });
    render(
      <I18nProvider>
        <PollSection
          limits={{
            maxOptions: 4,
            maxCharactersPerOption: 50,
            minExpiration: 300,
            maxExpiration: 600,
          }}
          mediaCount={1}
          onChange={vi.fn()}
          poll={undefined}
        />
      </I18nProvider>,
    );

    expect(screen.getByText('NO BOTH')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'POLL' })).toBeDisabled();
  });
});
