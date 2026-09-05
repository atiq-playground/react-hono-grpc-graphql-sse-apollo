/** @type {import('jest').Config} */
const config = {
  displayName: "node",
  testEnvironment: "node",
  rootDir: ".",
  roots: [
    "<rootDir>/apps/gateway",
    "<rootDir>/apps/producer",
    "<rootDir>/packages/proto",
    "<rootDir>/packages/shared",
    "<rootDir>/tools",
  ],
  extensionsToTreatAsEsm: [".ts"],
  testMatch: ["**/?(*.)+(test|spec).ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@repo/shared$": "<rootDir>/packages/shared/src/index.ts",
    "^@repo/shared/(.*)$": "<rootDir>/packages/shared/src/$1",
    "^@repo/proto$": "<rootDir>/packages/proto/src/index.ts",
    "^@repo/proto/(.*)$": "<rootDir>/packages/proto/src/$1",
  },
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.base.json",
        useESM: true,
        diagnostics: false,
      },
    ],
  },
};

module.exports = config;
