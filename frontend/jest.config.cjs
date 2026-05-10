/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/unit/**/*.test.ts'],
  moduleNameMapper: {
    // Redirect supabase imports to a mock so pure-function tests don't hit the network
    '.*supabase(\\.js)?$': '<rootDir>/tests/__mocks__/supabase.ts',
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
  // Unit tests cover only the pure-logic libs (no DB functions).
  // tournaments.ts is included separately in jest.integration.cjs coverage.
  collectCoverageFrom: [
    'src/lib/darts.ts',
    'src/lib/standings.ts',
    'src/lib/slug.ts',
    'src/lib/pool.ts',
  ],
  coverageThreshold: {
    global: { lines: 95 },
    './src/lib/darts.ts':     { lines: 95 },
    './src/lib/standings.ts': { lines: 100 },
    './src/lib/slug.ts':      { lines: 100 },
    './src/lib/pool.ts':      { lines: 100 },
  },
}
