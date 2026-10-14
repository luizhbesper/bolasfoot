import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['**/node_modules/', '**/.next/', 'original/', '**/next-env.d.ts', '.claude/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  { files: ['tools/*.mjs'], languageOptions: { globals: { URL: 'readonly', console: 'readonly' } } },
  // Motor determinístico: toda aleatoriedade vem do RNG; nada de relógio, IO ou Math que varia entre engines.
  {
    files: ['packages/engine/src/**/*.ts'],
    ignores: ['packages/engine/src/**/*.test.ts'],
    rules: {
      'no-restricted-properties': ['error', ...['random', 'pow', 'exp', 'log', 'sin', 'cos', 'tan', 'sqrt'].map((property) => ({ object: 'Math', property }))],
      'no-restricted-globals': ['error', 'Date', 'crypto', 'performance', 'process', 'setTimeout', 'setInterval'],
      'no-restricted-imports': ['error', { patterns: ['node:*'] }],
      'no-restricted-syntax': ['error', { selector: 'BinaryExpression[operator="**"]', message: 'use multiplicação' }],
    },
  },
)
