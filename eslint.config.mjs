import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
    // Ignore patterns
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'build/**',
            'coverage/**',
            'docs/experiments/**',
            'proxy/**',
            'scripts/**',
            'public/mebooks-integration.js',
            'mebooks-integration.js',
            'mebooks-integration-package/**',
            '*.min.js',
            '.vite/**',
            '.cache/**',
            'archive/**',
            'proxy_local.log',
            'proxy_local.pid',
            '*.config.js',
            '*.config.ts',
            'vite.config.ts',
            'vitest.config.ts',
            'vitest.setup.ts',
            'global.d.ts',
            'svg.d.ts',
            '*.json',
            '*.xml',
            '*.txt',
            '*.log',
        ],
    },

    // Base JavaScript config
    js.configs.recommended,

    // Main configuration for all TypeScript/React files
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: 'module',
                ecmaFeatures: {
                    jsx: true,
                },
                project: './tsconfig.json',
            },
            globals: {
                console: 'readonly',
                window: 'readonly',
                document: 'readonly',
                localStorage: 'readonly',
                fetch: 'readonly',
                navigator: 'readonly',
                alert: 'readonly',
                confirm: 'readonly',
                btoa: 'readonly',
                atob: 'readonly',
                URLSearchParams: 'readonly',
                URL: 'readonly',
                File: 'readonly',
                Blob: 'readonly',
                FileReader: 'readonly',
                FormData: 'readonly',
                Headers: 'readonly',
                Request: 'readonly',
                Response: 'readonly',
                AbortController: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': typescript,
            'react': react,
            'react-hooks': reactHooks,
            'import': importPlugin,
            'jsx-a11y': jsxA11y,
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
        rules: {
            // ========================================
            // CODE COMPLEXITY RULES
            // ========================================
            'max-lines': ['warn', {
                max: 500,
                skipBlankLines: true,
                skipComments: true,
            }],
            'max-lines-per-function': ['warn', {
                max: 100,
                skipBlankLines: true,
                skipComments: true,
                IIFEs: true,
            }],
            'complexity': ['warn', 15],
            'max-depth': ['warn', 4],
            'max-params': ['warn', 5],
            'max-nested-callbacks': ['warn', 3],

            // ========================================
            // NAMING CONVENTIONS
            // ========================================
            '@typescript-eslint/naming-convention': ['warn',
                {
                    selector: 'interface',
                    format: ['PascalCase'],
                },
                {
                    selector: 'typeAlias',
                    format: ['PascalCase'],
                },
                {
                    selector: 'enum',
                    format: ['PascalCase'],
                },
                {
                    selector: 'enumMember',
                    format: ['UPPER_CASE'],
                },
                {
                    selector: 'class',
                    format: ['PascalCase'],
                },
                {
                    selector: 'variable',
                    format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
                    leadingUnderscore: 'allow',
                },
                {
                    selector: 'function',
                    format: ['camelCase', 'PascalCase'],
                },
                {
                    selector: 'parameter',
                    format: ['camelCase'],
                    leadingUnderscore: 'allow',
                },
            ],

            // ========================================
            // IMPORT/EXPORT RULES
            // ========================================
            'import/order': ['warn', {
                groups: [
                    'builtin',
                    'external',
                    'internal',
                    'parent',
                    'sibling',
                    'index',
                ],
                pathGroups: [
                    {
                        pattern: 'react',
                        group: 'external',
                        position: 'before',
                    },
                ],
                pathGroupsExcludedImportTypes: ['react'],
                'newlines-between': 'always',
                alphabetize: {
                    order: 'asc',
                    caseInsensitive: true,
                },
            }],
            'import/no-duplicates': 'warn',
            '@typescript-eslint/no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
            }],

            // ========================================
            // CODE QUALITY RULES
            // ========================================
            'no-console': ['warn', {
                allow: ['warn', 'error'],
            }],
            'no-unused-vars': 'off',
            'no-empty': 'off',
            'no-undef': 'off',
            'no-useless-catch': 'warn',
            '@typescript-eslint/explicit-function-return-type': ['off', { // Off for now, too strict
                allowExpressions: true,
                allowTypedFunctionExpressions: true,
                allowHigherOrderFunctions: true,
            }],
            'prefer-const': 'warn',
            'no-var': 'error',
            'eqeqeq': ['error', 'always', { null: 'ignore' }],
            'no-unused-expressions': 'off',
            '@typescript-eslint/no-unused-expressions': 'warn',
            'consistent-return': 'off', // Too strict for React components

            // ========================================
            // REACT-SPECIFIC RULES
            // ========================================
            'react/react-in-jsx-scope': 'off',
            'react/prop-types': 'off',
            'react/jsx-key': 'error',
            'react/no-array-index-key': 'warn',
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            'react/self-closing-comp': 'warn',
            'react/jsx-no-useless-fragment': 'warn',

            // ========================================
            // ACCESSIBILITY RULES (jsx-a11y)
            // ========================================
            'jsx-a11y/alt-text': 'warn',
            'jsx-a11y/anchor-has-content': 'warn',
            'jsx-a11y/anchor-is-valid': 'warn',
            'jsx-a11y/aria-props': 'warn',
            'jsx-a11y/aria-proptypes': 'warn',
            'jsx-a11y/aria-unsupported-elements': 'warn',
            'jsx-a11y/click-events-have-key-events': 'warn',
            'jsx-a11y/heading-has-content': 'warn',
            'jsx-a11y/html-has-lang': 'warn',
            'jsx-a11y/img-redundant-alt': 'warn',
            'jsx-a11y/interactive-supports-focus': 'warn',
            'jsx-a11y/label-has-associated-control': 'warn',
            'jsx-a11y/mouse-events-have-key-events': 'warn',
            'jsx-a11y/no-access-key': 'warn',
            'jsx-a11y/no-autofocus': 'warn',
            'jsx-a11y/no-noninteractive-element-interactions': 'warn',
            'jsx-a11y/no-redundant-roles': 'warn',
            'jsx-a11y/no-static-element-interactions': 'warn',
            'jsx-a11y/role-has-required-aria-props': 'warn',
            'jsx-a11y/role-supports-aria-props': 'warn',
            'jsx-a11y/scope': 'warn',
            'jsx-a11y/tabindex-no-positive': 'warn',

            // ========================================
            // TYPESCRIPT-SPECIFIC RULES
            // ========================================
            '@typescript-eslint/consistent-type-imports': ['warn', {
                prefer: 'type-imports',
            }],
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/consistent-type-definitions': ['warn', 'interface'],
            '@typescript-eslint/no-non-null-assertion': 'warn',
            '@typescript-eslint/array-type': ['warn', {
                default: 'array',
            }],

            // ========================================
            // FORMATTING
            // ========================================
            'semi': ['warn', 'always'],
            'quotes': ['warn', 'single', {
                avoidEscape: true,
                allowTemplateLiterals: true,
            }],
            'comma-dangle': ['warn', 'always-multiline'],
            'no-multiple-empty-lines': ['warn', {
                max: 2,
                maxEOF: 1,
            }],
        },
    },

    // Relaxed rules for test files
    {
        files: ['**/__tests__/**/*', '**/*.test.ts', '**/*.test.tsx'],
        rules: {
            'max-lines': 'off',
            'max-lines-per-function': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            'no-console': 'off',
        },
    },

    // Relaxed rules for config files
    {
        files: ['*.config.ts', '*.config.js', '*.setup.ts'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
        },
    },
];
