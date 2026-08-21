import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts", "src/naics/fs-provider.ts"],
    dts: true,
    format: ["esm"],
    deps: { neverBundle: [/\.json$/] },
    publint: true,
    attw: { profile: "esm-only" },
  },
});
