module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  transform: { '^.+\\.(tsx?)$': 'ts-jest' },
  moduleFileExtensions: ['ts','js','json'],
  globalSetup: '<rootDir>/tests/setupServer.ts',
  globalTeardown: '<rootDir>/tests/teardownServer.ts'
};
