/**
 * The MSW server that keeps tests off the real network (AGENTS.md "Testing").
 *
 * It starts with no handlers: each API test registers what it needs with
 * `server.use(...)` and the handlers are reset after every test by the Vitest
 * setup. Any request no handler matches fails the test instead of reaching
 * the network.
 */
import { setupServer } from 'msw/node';

/** The shared interception server, with no default handlers. */
export const server = setupServer();
