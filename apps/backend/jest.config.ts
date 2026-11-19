import type { Config } from "jest";

const jestPreset = require("../../jest.preset.ts") as Config;

const config: Config = {
    ...jestPreset,
    displayName: "backend",
    testEnvironment: "node",
    transform: {
        "^.+\\.[tj]s$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.spec.json" }],
    },
    transformIgnorePatterns: ["node_modules/(?!kysely/)"],
    moduleFileExtensions: ["ts", "js", "html"],
    moduleNameMapper: {
        "^@cs-4347/db-operations$": "<rootDir>/../../packages/db-operations/src/index.ts",
        "^@cs-4347/db-schema$": "<rootDir>/../../packages/db-schema/src/index.ts",
    },
    coverageDirectory: "../../coverage/apps/backend",
};

module.exports = config;
