/**
 * Tests for the login box: it asks for the instance only when the build
 * leaves it to the visitor, sends what was typed, shows a refusal without
 * leaving the box, and can be cancelled.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PasswordLoginForm, type PasswordLoginFormProps } from './PasswordLoginForm';

/** Type into the field labelled {@link label}. */
function type(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('the login box', () => {
  it('sends the username and password, the password kept as a secret field', async () => {
    const onSubmit = vi.fn<PasswordLoginFormProps['onSubmit']>().mockResolvedValue({
      kind: 'error',
      message: 'nope',
    });
    render(<PasswordLoginForm askInstance={false} onClose={vi.fn()} onSubmit={onSubmit} />);

    type('Username', 'lain');
    type('Password', 'hunter2');
    fireEvent.click(screen.getByRole('button', { name: '[ log in ]' }));
    await screen.findByRole('alert');

    expect(screen.queryByLabelText('Instance')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      instance: '',
      username: 'lain',
      password: 'hunter2',
    });
  });

  it('asks for the instance when the build does not know it', async () => {
    const onSubmit = vi.fn<PasswordLoginFormProps['onSubmit']>().mockResolvedValue({
      kind: 'error',
      message: 'nope',
    });
    render(<PasswordLoginForm askInstance onClose={vi.fn()} onSubmit={onSubmit} />);

    type('Instance', 'wired.example');
    fireEvent.click(screen.getByRole('button', { name: '[ log in ]' }));
    await screen.findByRole('alert');

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      instance: 'wired.example',
      username: '',
      password: '',
    });
  });

  it('shows a refusal and lets the visitor try again', async () => {
    const onSubmit = vi.fn<PasswordLoginFormProps['onSubmit']>().mockResolvedValue({
      kind: 'error',
      message: 'Login failed: HTTP 400: Invalid credentials',
    });
    render(<PasswordLoginForm askInstance={false} onClose={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: '[ log in ]' }));

    const failure = await screen.findByRole('alert');

    expect(failure).toHaveTextContent('Invalid credentials');
    expect(screen.getByRole('button', { name: '[ log in ]' })).toBeEnabled();
  });

  it('stays quiet when the login succeeds, the parent taking over', async () => {
    const onSubmit = vi.fn<PasswordLoginFormProps['onSubmit']>().mockResolvedValue({
      kind: 'ok',
      account: {
        key: 'k',
        origin: 'https://wired.example',
        accountId: '1',
        handle: 'lain@wired.example',
        token: 't',
        refreshToken: null,
        expiresAt: null,
      },
    });
    render(<PasswordLoginForm askInstance={false} onClose={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: '[ log in ]' }));
    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
        instance: '',
        username: '',
        password: '',
      });
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('closes on cancel', () => {
    const onClose = vi.fn();
    render(<PasswordLoginForm askInstance={false} onClose={onClose} onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '[ cancel ]' }));

    expect(onClose).toHaveBeenCalledExactlyOnceWith();
  });
});
