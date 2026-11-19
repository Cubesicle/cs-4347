const { defineConfig } = require("@rstest/core") as typeof import("@rstest/core");

module.exports = defineConfig({
    globals: true,
    testEnvironment: "node",
    include: ["src/**/*.spec.ts", "src/**/*.test.ts"],
    source: {
        tsconfigPath: "./tsconfig.spec.json",
        decorators: {
            version: "legacy",
        },
    },
    tools: {
        swc: {
            jsc: {
                transform: {
                    legacyDecorator: true,
                    decoratorMetadata: true,
                },
            },
        },
    },
});
