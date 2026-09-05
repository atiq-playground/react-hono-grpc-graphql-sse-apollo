import nxPlugin from "@nx/eslint-plugin";
import tseslint from "typescript-eslint";

/**
 * Biome owns format/lint. This ESLint config exists only so Nx can enforce
 * module boundaries (apps → packages, never packages → apps).
 */
export default [
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@nx": nxPlugin,
    },
    rules: {
      "@nx/enforce-module-boundaries": [
        "error",
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            {
              sourceTag: "type:app",
              onlyDependOnLibsWithTags: ["type:package"],
            },
            {
              sourceTag: "type:package",
              onlyDependOnLibsWithTags: ["type:package"],
            },
          ],
        },
      ],
    },
  },
];
