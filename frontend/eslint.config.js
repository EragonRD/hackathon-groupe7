import js from '@eslint/js'
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/**
 * This is the new "flat config" for ESLint.
 * It combines the base rules for JavaScript and TypeScript with specific rules for React,
 * and finally applies Prettier for code formatting.
 *
 * @see https://eslint.org/docs/latest/use/configure/configuration-files-new
 */
export default tseslint.config(
  // Global ignores. You can add other directories like build, .turbo, etc.
  {
    ignores: ['dist'],
  },

  // Base configurations for all JS/TS files.
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Specific configuration for React files (TS and TSX).
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      // Apply recommended rules from the plugins.
      ...reactHooks.configs.recommended.rules,
      // Rule specific to Vite projects with React Fast Refresh.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Allow unused variables that start with an underscore (e.g., _confirmPassword)
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },

  {
    files: ['src/**/*.test.{js,jsx,ts,tsx}', 'src/test/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.vitest,
      },
    },
  },

  // Fichiers de config (vite/vitest) : contexte Node -> autorise process, etc.
  {
    files: ['*.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // Prettier configuration. This must be the LAST entry in the array
  // to ensure it overrides any conflicting style rules from other configs.
  eslintPluginPrettier,
)
