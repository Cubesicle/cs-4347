import type { Config } from "jest";

const jestPreset = require("../../jest.preset.ts") as Config;

const config: Config = {
    ...jestPreset,
    displayName: "backend-testing",
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
    coverageDirectory: "../../coverage/backend-testing",
};

module.exports = config;
