# @cajuncodemonkey/naics-search-react

A thin React hook wrapping [`@cajuncodemonkey/naics-search`](https://www.npmjs.com/package/@cajuncodemonkey/naics-search)'s
async load-state, so a React app doesn't have to hand-roll "is the model loaded yet,
did it error" boilerplate around `loadNaics()`.

Built for [naics-code-resolver](https://github.com/krcourville/naics-code-resolver) —
see that repo for the full resolver UI this package's sibling `naics-search` powers.

## Install

```sh
npm install @cajuncodemonkey/naics-search-react @cajuncodemonkey/naics-search
```

`react` (^19) is a peer dependency — bring your own, this package doesn't bundle it.

## Usage

```tsx
import { useNaicsSearch } from "@cajuncodemonkey/naics-search-react";

function Resolver() {
  const naics = useNaicsSearch();

  if (naics.status === "loading") return <p>Loading…</p>;
  if (naics.status === "error") return <p>Couldn't load NAICS data: {String(naics.error)}</p>;

  // naics.status === "ready" — search()/drilldown fns are available
  return <SearchForm onSubmit={(text) => naics.search(text)} />;
}
```

## API

### `useNaicsSearch(): Status`

No arguments — data-source configuration (if you need it) is set globally via
`naics-search`'s `configureDataProvider()` before your app mounts, not through this
hook. `Status` is a discriminated union on `status`:

```ts
type Status =
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | {
      status: "ready";
      search: typeof search;
      drilldownOptions: typeof drilldownOptions;
      getNode: typeof getNode;
      isResolved: typeof isResolved;
      getAncestorPath: typeof getAncestorPath;
      censusUrl: typeof censusUrl;
    };
```

TypeScript narrows `naics.search`/the drilldown fns into scope only once
`naics.status === "ready"` — there's no runtime guard to remember, the type system
enforces it.

The hook owns no app policy — confidence bands, settings, Q&A UI flow all stay in your
app, same as they do in [naics-code-resolver's own app](https://github.com/krcourville/naics-code-resolver/tree/main/apps/naics-resolver).

## Caveats

- Unmounting mid-load is safe — the hook guards against `setState` on an unmounted
  component. It does not cancel the underlying `loadNaics()` fetch (that's a shared,
  cached load across the whole app, not owned by any one hook instance).
- No built-in retry UI. `naics-search`'s cache only holds onto a _successful_ load, not
  a failed one, so remounting the component that calls `useNaicsSearch()` (e.g. a
  React `key` change) after an error retries fresh. The hook itself has no manual
  `retry()` — it's a one-shot-per-mount wrapper by design.

## License

MIT.
