import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['**/node_modules/', '**/.next/', 'original/', '**/next-env.d.ts'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  { files: ['tools/*.mjs'], languageOptions: { globals: { URL: 'readonly', console: 'readonly' } } },
)
