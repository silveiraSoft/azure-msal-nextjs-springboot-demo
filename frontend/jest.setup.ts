/**
 * jest.setup.ts — runs once before every test file.
 *
 * @testing-library/jest-dom adds custom matchers to Jest:
 *   toBeInTheDocument(), toHaveTextContent(), toBeDisabled(), etc.
 */
import "@testing-library/jest-dom";

// Silence MSAL's console.info during tests
global.console.info = jest.fn();
