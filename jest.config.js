export default {
  transform: {
    '^.+\\.tsx?$': 'babel-jest',
  },
  moduleNameMapper: {
    // map @web/* -> <rootDir>/src/* for tests (handle .js imports too)
    '^@web/(.*)\\.js$': '<rootDir>/src/$1',
    '^@web/(.*)$': '<rootDir>/src/$1',
    // map ESM-style .js relative imports back to TS source during tests
    '^(\.{1,}/.*)\\.js$': '$1',
    '^(\/.*)\\.js$': '$1',
  },
  testEnvironment: 'node',
  testMatch: ['**/src/**/*.test.ts'],
  globalSetup: '<rootDir>/jest.globalSetup.js',
  globalTeardown: '<rootDir>/jest.globalTeardown.js',
};