import { suffix } from "bun:ffi";
import { basename, parse } from "path";
import Loader from "../../loader";
import { parseZigTypes } from "./parse-types";

export default class ZigLoader extends Loader {
    constructor() {
        super("Zig Loader",
            {
                extension: "zig",
                buildCommand: (importPath, outDir) => {
                    const libPrefix = process.platform === "win32" ? "" : "lib";
                    return [
                        "zig",
                        "build-lib",
                        importPath,
                        "-dynamic",
                        "-OReleaseFast",
                        `-femit-bin=${outDir}/${libPrefix}${parse(importPath).name}.${suffix}`
                    ];
                },
                outDir: importPath => `build/${basename(importPath)}`,
                parseTypes: async (importPath) => {
                    const sourceCode = await Bun.file(importPath).text();
                    return parseZigTypes(sourceCode);
                }
            }
        );
    }
}