/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/integration/**/*.test.ts'],
  // Integration tests use real Supabase — redirect to a Node-compatible client
  // that reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from process.env
  moduleNameMapper: {
    '.*supabase(\\.js)?$': '<rootDir>/tests/__mocks__/supabase.integration.ts',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.test.json',
        diagnostics: { ignoreCodes: ['TS151001'] },
      },
    ],
  },
  // Load .env.test before any test runs
  globalSetup: '<rootDir>/tests/integration/setup.ts',
  testTimeout: 30000,
}
