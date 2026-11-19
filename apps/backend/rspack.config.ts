import type { Configuration } from "@rspack/core";

const { join } = require("node:path") as typeof import("node:path");
const { NxAppRspackPlugin } =
    require("@nx/rspack/app-plugin") as typeof import("@nx/rspack/app-plugin");

const config: Configuration = {
    output: {
        path: join(__dirname, "../../dist/apps/backend"),
        clean: true,
        ...(process.env["NODE_ENV"] !== "production" && {
            devtoolModuleFilenameTemplate: "[absolute-resource-path]",
        }),
    },
    plugins: [
        new NxAppRspackPlugin({
            target: "node",
            main: "./src/main.ts",
            tsConfig: "./tsconfig.app.json",
            optimization: false,
            outputHashing: "none",
            sourceMap: true,
        }),
    ],
};

module.exports = config;
