/**
 * Tests for the one boot the shell runs on mount: `bootOnce` starts exactly
 * the first time and is inert once the flag is raised, and `useStartup` hands
 * `runStartup` the live dispatch, the shared stores, the build configuration
 * and a fresh clock, injecting no detector of its own, even under StrictMode.
 */
import { renderHook } from '@testing-library/react';
import { StrictMode, type JSX, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { runStartup } from './startup';
import { appStores } from './stores';
import { bootOnce, useStartup } from './useStartup';
import { buildConfig } from '../config/config';
import { AppStateProvider } from '../state/StateContext';

/** Startup itself is tested beside the module; here it only has to be seen. */
vi.mock(import('./startup'), () => ({ runStartup: vi.fn() }));

/** The mocked boot, typed as the real `runStartup`. */
const started = vi.mocked(runStartup);

/** The provider the hook takes its dispatch from. */
function withProvider(props: { readonly children: ReactNode }): JSX.Element {
  return <AppStateProvider>{props.children}</AppStateProvider>;
}

/** The same provider, under StrictMode. */
function withStrictProvider(props: { readonly children: ReactNode }): JSX.Element {
  return (
    <StrictMode>
      <AppStateProvider>{props.children}</AppStateProvider>
    </StrictMode>
  );
}

describe(bootOnce, () => {
  it('boots the first time and raises the flag', () => {
    let raised = false;
    const boot = vi.fn();

    bootOnce(
      raised,
      () => {
        raised = true;
      },
      boot,
    );

    expect(boot).toHaveBeenCalledTimes(1);
    expect(raised).toBe(true);
  });

  it('is inert once the flag is raised', () => {
    const raised = true;
    const boot = vi.fn();

    bootOnce(raised, () => undefined, boot);

    expect(boot).not.toHaveBeenCalled();
  });
});

describe(useStartup, () => {
  it('runs startup once with the live dependencies', () => {
    renderHook(
      () => {
        useStartup();
      },
      { wrapper: withProvider },
    );

    const deps = started.mock.calls[0]?.[0];

    expect(started).toHaveBeenCalledTimes(1);
    expect(deps?.stores).toBe(appStores());
    expect(deps?.config).toBe(buildConfig);
    expect(deps?.detect).toBeUndefined();
    expect(deps?.now()).toBeInstanceOf(Date);
  });

  it('boots exactly once even under StrictMode', () => {
    renderHook(
      () => {
        useStartup();
      },
      { wrapper: withStrictProvider },
    );

    expect(started).toHaveBeenCalledTimes(1);
  });
});
