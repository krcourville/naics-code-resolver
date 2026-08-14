# NAICS Code Resolver

A that resolves NAICS code for a business based on a description, using
a machine learning model and entirely in your web browser.

**Live:** https://krcourville.github.io/naics-code-resolver/

## Getting Started

```bash
git submodule update --init   # pulls the beacon submodule
vp install                    # installs deps
vp dev                        # dev server at http://localhost:5173
```

Type a business description, get a 6-digit NAICS code + confidence.
Low/medium confidence offers a drill-down Q&A to narrow it down.

### Tests

```bash
vp test                       # unit tests (vitest)
vp check                      # format + lint + typecheck
pnpm exec playwright test     # e2e suite (starts dev server itself)
```

First e2e run needs browsers: `pnpm exec playwright install chromium`.

### Build

```bash
pnpm build                    # tsc + vp build -> dist/
```

The model artifact (`public/naics-model.json`) is committed, not
regenerated during build. To refit it manually: `python scripts/build-model.py`
(needs the beacon submodule). `pnpm infer "<description>"` queries the
committed model directly, useful for manual sanity checks.
