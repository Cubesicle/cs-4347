import type { Config } from "jest";

const jestPreset = require("../../jest.preset.ts") as Config;

const config: Config = {
    ...jestPreset,
    displayName: "api",
    testEnvironment: "node",
    transform: {
        "^.+\\.[tj]s$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.spec.json" }],
    },
    transformIgnorePatterns: ["node_modules/(?!kysely/)"],
    moduleFileExtensions: ["ts", "js", "html"],
    moduleNameMapper: {
        "^@cs-4347/database$": "<rootDir>/../../packages/database/src/index.ts",
        "^@cs-4347/db-schema$": "<rootDir>/../../packages/db-schema/src/index.ts",
    },
    coverageDirectory: "../../coverage/apps/api",
};

module.exports = config;
