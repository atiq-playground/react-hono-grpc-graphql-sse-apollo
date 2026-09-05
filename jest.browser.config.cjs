/** @type {import('jest').Config} */
const config = {
  displayName: "browser",
  testEnvironment: "jsdom",
  rootDir: ".",
  roots: ["<rootDir>/apps/dashboard", "<rootDir>/packages/ui", "<rootDir>/packages/shared"],
  testMatch: ["**/?(*.)+(test|spec).(ts|tsx)"],
  moduleNameMapper: {
    "^@repo/ui$": "<rootDir>/packages/ui/src/index.ts",
    "^@repo/ui/(.*)$": "<rootDir>/packages/ui/src/$1",
    "^@repo/shared$": "<rootDir>/packages/shared/src/index.ts",
    "^@repo/shared/(.*)$": "<rootDir>/packages/shared/src/$1",
    "^@repo/proto$": "<rootDir>/packages/proto/src/index.ts",
    "^@repo/proto/(.*)$": "<rootDir>/packages/proto/src/$1",
    "\\.(css|less|scss)$": "identity-obj-proxy",
  },
  setupFilesAfterEnv: ["<rootDir>/apps/dashboard/src/test/setup.ts"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/apps/dashboard/tsconfig.json",
        useESM: false,
        diagnostics: false,
      },
    ],
  },
};

module.exports = config;
