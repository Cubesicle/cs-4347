import type { Configuration } from "webpack";

const { join } = require("node:path") as typeof import("node:path");
const { NxAppWebpackPlugin } =
    require("@nx/webpack/app-plugin") as typeof import("@nx/webpack/app-plugin");

const config: Configuration = {
    output: {
        path: join(__dirname, "../../dist/apps/api"),
        clean: true,
        ...(process.env["NODE_ENV"] !== "production" && {
            devtoolModuleFilenameTemplate: "[absolute-resource-path]",
        }),
    },
    plugins: [
        new NxAppWebpackPlugin({
            target: "node",
            compiler: "tsc",
            main: "./src/main.ts",
            tsConfig: "./tsconfig.app.json",
            assets: ["./src/assets"],
            optimization: false,
            outputHashing: "none",
            generatePackageJson: true,
            sourceMap: true,
        }),
    ],
};

module.exports = config;
