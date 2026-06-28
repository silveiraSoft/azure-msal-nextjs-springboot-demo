import type { Config } from "jest";
import nextJest from "next/jest.js";

/**
 * Jest configuration for Next.js 14 (App Router).
 *
 * nextJest() does three things automatically:
 *   1. Transforms JSX/TSX with the Next.js compiler (SWC) — faster than Babel
 *   2. Loads .env.local / .env.test into process.env
 *   3. Sets up CSS module mocks so imports don't crash in Node
 */
const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  // jsdom simulates a browser DOM environment for React component tests.
  // Use "node" for tests that don't need DOM (e.g., pure utility functions).
  testEnvironment: "jest-environment-jsdom",

  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],

  // Map @/ path alias to src/ (matches tsconfig.json paths)
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },

  // Test file locations
  testMatch: [
    "<rootDir>/src/**/*.test.{ts,tsx}",
    "<rootDir>/src/**/*.spec.{ts,tsx}",
  ],

  // Coverage configuration
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/app/layout.tsx",   // boilerplate
    "!src/app/globals.css",
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 70,
      statements: 70,
    },
  },
};

// createJestConfig wraps config to merge Next.js defaults with ours
export default createJestConfig(config);
