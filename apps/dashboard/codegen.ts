import type { CodegenConfig } from "@graphql-codegen/cli";

/**
 * Dashboard GraphQL codegen (client preset). Reads the gateway SDL from disk at
 * build time only; the dashboard never imports gateway runtime code. Run from
 * `apps/dashboard` (the Nx `codegen` target sets the cwd).
 */
const config: CodegenConfig = {
  schema: "../gateway/src/graphql/schema.graphql",
  documents: ["src/graphql/operations.graphql"],
  ignoreNoDocuments: true,
  generates: {
    "./src/graphql/__generated__/": {
      preset: "client",
      presetConfig: {
        fragmentMasking: false,
      },
      config: {
        useTypeImports: true,
        enumsAsTypes: true,
        skipTypename: true,
        scalars: {
          ID: "string",
        },
      },
    },
  },
};

export default config;
