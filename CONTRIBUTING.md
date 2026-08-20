# Contributing

## Releasing `@cajuncodemonkey/naics-search`

1. Bump `version` in `packages/naics-search/package.json` (e.g. `pnpm --filter @cajuncodemonkey/naics-search version patch`).
2. Commit the bump.
3. Tag: `git tag naics-search-vX.Y.Z && git push --tags`.
4. The `publish-naics-search` GitHub Actions workflow builds and publishes to npm on
   that tag push, authenticating via npm Trusted Publisher (OIDC) — no token needed.
