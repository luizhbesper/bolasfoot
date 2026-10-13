# Bolasfoot

Port do Brasfoot 22-23 para o navegador, multiplayer com amigos.

## Onde está o quê

- `docs/plano.md` — arquitetura, fases, tickets (F0-x, M1…). Comece por aqui.
- `docs/engenharia-reversa.md` — fórmulas e constantes do original.
- `docs/ref/*.png` — telas do jogo original (gabarito da UI).
- `original/` — gitignored; gerado por `tools/extract.sh ~/Downloads/brasfoot22-23.exe`. Java decompilado em `original/src`.
- `apps/web` — Next.js (UI, API, SSE). `packages/engine` — motor puro. `packages/data` — ETL → `base.json`.

## Comandos

```sh
docker compose up -d   # Postgres local (bolasfoot + bolasfoot_test)
pnpm dev               # app em localhost:3000 (precisa de .env, copie .env.example)
pnpm check             # typecheck + lint + test — tem que ficar verde antes de commitar
pnpm e2e               # Playwright
pnpm data:build        # original/data → packages/data/base.json
pnpm assets            # original/ → apps/web/public/assets
pnpm sim               # (Fase 1) simula N partidas
pnpm db:migrate | db:seed | db:reset   # (Fase 3)
```

## Regras

- `packages/engine`: sem IO, sem `Math.random`, sem `Date`, sem `crypto`; toda aleatoriedade vem do RNG do motor.
- Fórmulas portadas citam a fonte Java: `// Fonte: best/F.java:538`.
- Nunca editar `original/`.
- Rotas de teste só com `TEST_ENDPOINTS=1`; nunca em prod.
- Commits na `dev`, um branch por ticket saindo dela; `main` = prod.
