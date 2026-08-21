# Contributing

## Releasing `@cajuncodemonkey/naics-search`

1. Bump `version` in `packages/naics-search/package.json` (e.g. `pnpm --filter @cajuncodemonkey/naics-search version patch`). Bump `packages/naics-search-data/package.json`'s `version` to match — the two must stay in lockstep.
2. Commit both bumps.
3. Tag: `git tag naics-search-vX.Y.Z && git push --tags`.
4. The `publish-naics-search` GitHub Actions workflow, on that tag push:
   - publishes `@cajuncodemonkey/naics-search` to npm (Trusted Publisher/OIDC, no token needed),
   - publishes `@cajuncodemonkey/naics-search-data` to npm (same tag, same version — this is what `naics-search`'s default CDN provider fetches from via unpkg),
   - creates a GitHub Release for the tag with `naics-model.json`/`naics-hierarchy.json` attached (the fallback data source if unpkg is unreachable).

## Releasing `@cajuncodemonkey/naics-search-react`

1. Bump `version` in `packages/naics-search-react/package.json`.
2. Commit the bump.
3. Tag: `git tag naics-search-react-vX.Y.Z && git push --tags`.
4. The `publish-naics-search-react` GitHub Actions workflow builds and publishes to npm on that tag push (Trusted Publisher/OIDC).

## First publish of a new package (Trusted Publisher bootstrap)

npm's OIDC Trusted Publisher can only be configured _after_ a package's very first
version exists on the registry — CI can't publish version 1 on its own the first time.
One-time bootstrap for any brand-new package under this scope:

1. Build it, then publish manually with your own npm login (2FA/OTP required —
   `npm publish`/`pnpm publish` from an interactive terminal):
   ```sh
   pnpm --filter <pkg-name> run build
   cd packages/<pkg-dir> && npm publish --access public
   ```
2. On [npmjs.com](https://www.npmjs.com), the package's Settings → Publishing access →
   add a Trusted Publisher: GitHub Actions, org/user `krcourville`, repo
   `naics-code-resolver`, workflow filename matching that package's publish workflow
   (e.g. `publish-naics-search.yml`), no environment, "Allow npm publish".
3. From then on, tag-triggered CI publishes every subsequent version — no more manual
   publishing. (Re-running CI against the _same_ version you just bootstrapped will fail
   with "cannot publish over previously published version" — expected, harmless, ignore
   it; the version is already live.)
