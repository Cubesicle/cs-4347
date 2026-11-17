import type { Config } from "jest";

const nxPreset = (require("@nx/jest/preset") as { default: Config }).default;

const jestPreset: Config = { ...nxPreset };

module.exports = jestPreset;
