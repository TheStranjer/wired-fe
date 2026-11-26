/**
 * Tests that the text of the modal boxes and choice groups of `src/ui`
 * (A–M) goes through `t()` (decision 19): under a fake language every string
 * of the account picker, the confirm dialog, the error alert, the media review
 * box, the mute durations and the instance choices reads the fake catalog.
 */
import { render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AccountPickerDialog } from './AccountPickerDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorAlert } from './ErrorAlert';
import { InstanceChoices } from './InstanceChoices';
import { MediaReviewDialog } from './MediaReviewDialog';
import { MuteDurations } from './MuteDurations';
import { I18nProvider } from '../i18n/I18nProvider';
import { installFakeLocale } from '../test/i18n';

/** Switch to the fake language, then show {@link ui} under the provider. */
function renderFake(ui: JSX.Element): void {
  installFakeLocale({
    ui: {
      account_picker_dialog: {
        accounts: 'XX accounts',
        cancel: 'XX cancel',
        ok: 'XX ok',
        remember: 'XX remember',
      },
      confirm_dialog: { cancel: 'XX back' },
      error_alert: { count: 'XX times {count}', label: 'XX error', ok: 'XX fine' },
      instance_choices: { legend: 'XX instance', other: 'XX other' },
      media_review_dialog: {
        attachments: 'XX files',
        cancel: 'XX cancel',
        description_for: 'XX alt of {name}',
        missing: 'XX none',
        submit: 'XX send',
        summary: 'XX {missing}/{total} bare',
        title: 'XX describe',
      },
      mute_durations: {
        days: '{count} XXd',
        forever: 'XX forever',
        group: 'XX mute for',
        hours: '{count} XXh',
        minutes: '{count} XXm',
      },
    },
  });
  render(<I18nProvider>{ui}</I18nProvider>);
}

describe('the modal boxes of src/ui in another language', () => {
  it('words the account picker from the catalog', () => {
    renderFake(
      <AccountPickerDialog
        accounts={[{ key: 'a', label: '@a@x.example' }]}
        description="state"
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
        scope="desk"
        scopes={[{ value: 'desk', label: 'desk' }]}
        selected="a"
        title="Post as"
      />,
    );

    expect(screen.getByRole('group', { name: 'XX accounts' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'XX remember' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'XX cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'XX ok' })).toBeInTheDocument();
  });

  it('words the default cancel button of the confirm dialog from the catalog', () => {
    renderFake(
      <ConfirmDialog
        confirmLabel="Delete"
        message="Sure?"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete?"
      />,
    );

    expect(screen.getByRole('button', { name: 'XX back' })).toBeInTheDocument();
  });

  it('words the error alert, its repeat count and its button from the catalog', () => {
    renderFake(<ErrorAlert count={3} onDismiss={vi.fn()} text="boom" />);

    expect(screen.getByRole('alertdialog', { name: 'XX error' })).toBeInTheDocument();
    expect(screen.getByText('XX times 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'XX fine' })).toBeInTheDocument();
  });

  it('words the media review box from the catalog', () => {
    renderFake(
      <MediaReviewDialog
        items={[{ key: 'k', name: 'cat.png', previewUrl: null, description: '' }]}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'XX describe' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'XX describe' })).toBeInTheDocument();
    expect(screen.getByText('XX 1/1 bare')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'XX files' })).toBeInTheDocument();
  });

  it('words a row and the buttons of the media review box from the catalog', () => {
    renderFake(
      <MediaReviewDialog
        items={[{ key: 'k', name: 'cat.png', previewUrl: null, description: '' }]}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText('XX none')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'XX alt of cat.png' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'XX cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'XX send' })).toBeInTheDocument();
  });

  it('words the mute durations from the catalog', () => {
    renderFake(<MuteDurations onChange={vi.fn()} value="" />);

    expect(screen.getByRole('radiogroup', { name: 'XX mute for' })).toBeInTheDocument();
    expect(
      screen.getAllByRole('radio').map((radio) => radio.parentElement?.textContent),
    ).toStrictEqual(['XX forever', '30 XXm', '1 XXh', '6 XXh', '1 XXd', '3 XXd', '7 XXd']);
  });

  it('words the instance choices from the catalog', () => {
    renderFake(
      <InstanceChoices allowCustom onChange={vi.fn()} origins={['https://w.example']} value="" />,
    );

    expect(screen.getByRole('group', { name: 'XX instance' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'XX other' })).toBeInTheDocument();
  });
});
