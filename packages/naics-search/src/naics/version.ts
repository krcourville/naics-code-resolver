/**
 * `package.json`'s `version`, duplicated as a plain string constant (⊥ JSON
 * import — avoids reintroducing the import-attribute dance B6-B8 already paid
 * for). A test asserts this stays equal to `package.json`'s real version
 * (V64) — this is also `naics-search-data`'s expected version, and the tag
 * `default-provider.ts` fetches against.
 */
export const PKG_VERSION = "2.0.0";
