import { defineConfig } from 'drizzle-kit'

// Só para gerar migrations (pnpm --filter web db:generate); aplicar é com pnpm db:migrate.
export default defineConfig({ dialect: 'postgresql', schema: './lib/db/schema.ts', out: './drizzle' })
