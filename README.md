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

> Status: **Deployable MVP (M1–M4 done).** The schema + PDF organize engine, the
> in-browser GUI, the local CLI, and the light Worker + Cloud Run proxy are
> implemented, unit-tested (Vitest, Node + happy-dom, with coverage), and verified
> end-to-end in a browser. Cloud Run (`securepdf-run`) and exotic image codecs are
> the remaining tracks. See [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md).

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
| `pnpm lint` | Prettier check + ESLint (react-hooks, jsx-a11y, import-sort) |
| `pnpm typecheck` | `tsc --noEmit` across all packages |
| `pnpm test` | Vitest (Node + happy-dom projects) |
| `pnpm coverage` | Vitest with v8 coverage report |
| `pnpm gen:fixtures` | Regenerate the synthetic `fixtures/` |
| `pnpm build` | Build the web SPA into `apps/web/dist` |
| `pnpm deploy` | Build, then `wrangler deploy` |

## Use the CLI

```bash
pnpm -C apps/cli build                       # bundle to apps/cli/dist/cli.js
node apps/cli/dist/cli.js capabilities --json
node apps/cli/dist/cli.js merge a.pdf b.pdf -o out.pdf
node apps/cli/dist/cli.js convert image.png --to pdf -o image.pdf
node apps/cli/dist/cli.js rotate in.pdf --pages 1,last --degrees 90 -o rotated.pdf
node apps/cli/dist/cli.js delete in.pdf --pages 2,4-5 -o removed.pdf
node apps/cli/dist/cli.js extract in.pdf --pages 1,3-4 -o extracted.pdf
node apps/cli/dist/cli.js flip in.pdf --pages even --axis horizontal -o flipped.pdf
node apps/cli/dist/cli.js reorder in.pdf --order 3,1,2 -o reordered.pdf
node apps/cli/dist/cli.js insert-pdf base.pdf appendix.pdf --at 3 -o inserted.pdf
node apps/cli/dist/cli.js insert-image base.pdf scan.png --at 0 -o with-scan.pdf
node apps/cli/dist/cli.js split in.pdf --every 1 -o page.pdf
node apps/cli/dist/cli.js organize --input a=a.pdf --plan plan.json -o out.pdf
```

Office files use the same `convert` command, but require a configured endpoint:

```bash
node apps/cli/dist/cli.js convert deck.pptx --to pdf \
  --endpoint https://securepdf.example.com --api-key "$SECUREPDF_API_KEY" -o deck.pdf
```

## Deploy (Cloudflare, free tier)

```bash
pnpm build                                   # → apps/web/dist
wrangler deploy --dry-run                    # validate bundle + assets (no account)
wrangler deploy                              # needs `wrangler login`
```

To enable heavy operations later, set the Cloud Run backend (heavy endpoints
return `503 BACKEND_NOT_CONFIGURED` until then):

```bash
wrangler secret put CLOUD_RUN_URL            # base URL of the securepdf-run service
wrangler secret put CLOUD_RUN_TOKEN          # optional bearer token (keeps it private)
```

## Documentation

- [Implementation plan (v3)](docs/IMPLEMENTATION_PLAN.md)
- [Refactoring & optimization (2026-06)](docs/REFACTORING_PLAN.md) — GUI decomposition, bundle split, tooling
- [Cloud Run boundary](docs/CLOUD_RUN_BOUNDARY.md) — the two-tier split & contract
- [Plan audit](docs/PLAN_AUDIT.md) — historical (audits the pre-v3 plan)
- [Decisions](docs/DECISIONS.md)
- [Architecture](docs/architecture.md) · [API](docs/api.md) · [Security](docs/security.md)

Public in-app documentation pages are Markdown-managed under
`apps/web/content/ja/`:

- `overview.md`: service overview
- `security.md`: security policy
- `api.md`: API documentation

## License

TBD.
