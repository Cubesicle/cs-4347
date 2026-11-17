import type { Config } from "jest";

const jestPreset = require("../../jest.preset.ts") as Config;

const config: Config = {
    ...jestPreset,
    displayName: "api-e2e",
    globalSetup: "<rootDir>/src/support/global-setup.ts",
    globalTeardown: "<rootDir>/src/support/global-teardown.ts",
    setupFiles: ["<rootDir>/src/support/test-setup.ts"],
    testEnvironment: "node",
    transform: {
        "^.+\\.[tj]s$": [
            "ts-jest",
            {
                tsconfig: "<rootDir>/tsconfig.spec.json",
            },
        ],
    },
    moduleFileExtensions: ["ts", "js", "html"],
    coverageDirectory: "../../coverage/api-e2e",
};

module.exports = config;
