/**
 * MSW Node server — used in Jest (Node.js environment).
 *
 * Import `server` in jest.setup.ts or individual test files:
 *   beforeAll(() => server.listen())
 *   afterEach(() => server.resetHandlers())
 *   afterAll(() => server.close())
 */
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
