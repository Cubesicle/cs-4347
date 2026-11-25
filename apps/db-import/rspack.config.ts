import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NxAppRspackPlugin } from "@nx/rspack/app-plugin";
import type { Configuration } from "@rspack/core";

const __dirname = dirname(fileURLToPath(import.meta.url));

const config: Configuration = {
    output: {
        path: join(__dirname, "../../dist/apps/db-import"),
        clean: true,
    },
    plugins: [
        new NxAppRspackPlugin({
            target: "node",
            main: "./src/main.ts",
            tsConfig: "./tsconfig.json",
            optimization: false,
            outputHashing: "none",
            sourceMap: true,
        }),
    ],
};

export default config;
