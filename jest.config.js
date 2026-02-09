export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'jsdom',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          lib: ['ES2021', 'dom', 'webworker'],
          types: ['chrome', 'node', 'jest'],
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/src/$1',
    '^@math/math.wasm$': '<rootDir>/test/mocks/math-wasm.ts',
    '^@tools/(.*)$': '<rootDir>/tools/$1',
    '^@test/(.*)$': '<rootDir>/test/$1'
  },
  testMatch: ['**/test/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
};
