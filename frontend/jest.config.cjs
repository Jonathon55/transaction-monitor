/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest', // <- CommonJS; simpler & more reliable
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  transform: {
    '^.+\\.(t|j)sx?$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'es2020',
          module: 'commonjs',
          moduleResolution: 'node',
          jsx: 'react-jsx',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          isolatedModules: true,
          types: ['jest', 'node', '@testing-library/jest-dom', 'vite/client'],
        },
      },
    ],
  },
  moduleNameMapper: {
    '\\.(css|scss|less)$': '<rootDir>/src/test/__mocks__/styleMock.js',
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.cjs'],
};
