import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

/**
 * `src/core` is the platform-agnostic layer that a future React Native (Expo)
 * client will consume verbatim. These rules make that boundary a build failure
 * rather than a code-review convention: no framework imports, no DOM globals.
 * Anything platform-specific must enter through an injected port instead.
 */
const corePurityRules = {
  files: ['src/core/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [
          { name: 'next', message: 'src/core must stay framework-agnostic.' },
          { name: 'react-dom', message: 'src/core must stay renderer-agnostic.' },
          { name: 'server-only', message: 'src/core must run on any platform.' },
          { name: 'client-only', message: 'src/core must run on any platform.' },
        ],
        patterns: [
          {
            group: ['next/*', 'react-dom/*'],
            message: 'src/core must stay framework- and renderer-agnostic.',
          },
          {
            group: ['@/app/*', '@/components/*', '@/features/*', '@/hooks/*', '@/lib/*'],
            message:
              'src/core must not depend on the web UI layer. Invert the dependency.',
          },
        ],
      },
    ],
    'no-restricted-globals': [
      'error',
      {
        name: 'window',
        message: 'Not available in React Native. Inject a platform port instead.',
      },
      {
        name: 'document',
        message: 'Not available in React Native. Inject a platform port instead.',
      },
      {
        name: 'localStorage',
        message: 'Use the StorageAdapter port from src/core/ports instead.',
      },
      {
        name: 'sessionStorage',
        message: 'Use the StorageAdapter port from src/core/ports instead.',
      },
    ],
  },
};

const projectRules = {
  files: ['**/*.{ts,tsx}'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/consistent-type-imports': [
      'error',
      { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
    ],
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    eqeqeq: ['error', 'always', { null: 'ignore' }],
    'prefer-const': 'error',
    'object-shorthand': ['error', 'properties'],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  projectRules,
  corePurityRules,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'public/**',
    'coverage/**',
    'test-results/**',
    'playwright-report/**',
    'blob-report/**',
    'Azure DevOps REST API v7.2-Preview.postman_collection.json',
  ]),
]);

export default eslintConfig;
