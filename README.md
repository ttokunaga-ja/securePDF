# securePDF

A PDF organization and "To PDF" conversion tool, exposed through one shared
engine via three entry points — **browser GUI**, **CLI**, and **HTTP API** —
deployed as a single **Cloudflare Worker with Static Assets**.

**This repo runs entirely on the Cloudflare free tier:** static SPA delivery,
**in-browser** PDF processing (local-first), and a *light* Worker that serves
`capabilities`/`openapi.json`/`validate-plan` and **proxies** heavy operations to
a separate **Cloud Run** service. Anything that can't run for free on Cloudflare
(large PDFs, Office→PDF, native qpdf/Ghostscript/LibreOffice) lives in the Cloud
Run repo (`securepdf-run`, reusing `@securepdf/core`). See
[`docs/CLOUD_RUN_BOUNDARY.md`](docs/CLOUD_RUN_BOUNDARY.md).

> Status: **Milestone 0 — project scaffold.** Feature logic is not implemented
> yet; packages export typed stubs. See [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md).

## Why one engine

GUI, CLI, and API all produce or consume the same **versioned operation schema**
(`packages/schema`) and call the same **runtime-neutral core** (`packages/core`).
No separate implementations, no separate backend.

## Layout

```text
apps/
  web/        Vite + React 19 + MUI 6 SPA (local-first)
  cli/        npm CLI package
  worker/     Cloudflare Worker — API + static-asset host
packages/
  schema/     Operation schema, validation, OpenAPI generation
  core/        Runtime-neutral PDF engine (@cantoo/pdf-lib)
  codecs/      Optional, lazily-loaded image decoders
fixtures/     Shared test PDFs / images
docs/         Plan, audit, decisions, architecture, api, security
```

## Develop

```bash
pnpm install          # Node >= 20, pnpm 11
pnpm dev:web          # run the SPA locally
pnpm dev:worker       # run the Worker (serves /api/* + built assets)
pnpm check            # lint + typecheck + test + build
```

| Command | Does |
|---|---|
| `pnpm lint` | Prettier check + ESLint |
| `pnpm typecheck` | `tsc --noEmit` across all packages |
| `pnpm test` | Vitest |
| `pnpm build` | Build the web SPA into `apps/web/dist` |
| `pnpm deploy` | Build, then `wrangler deploy` |

## Documentation

- [Implementation plan (v3)](docs/IMPLEMENTATION_PLAN.md)
- [Cloud Run boundary](docs/CLOUD_RUN_BOUNDARY.md) — the two-tier split & contract
- [Plan audit](docs/PLAN_AUDIT.md)
- [Decisions](docs/DECISIONS.md)
- [Architecture](docs/architecture.md) · [API](docs/api.md) · [Security](docs/security.md)

## License

TBD.
