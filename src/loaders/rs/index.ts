import { basename } from "path";
import Loader from "../../loader";
import { parseRustTypes } from "./parse-types";

export default class RustLoader extends Loader {
    constructor() {
        super("Rust Loader",
            {
                extension: "rs",
                buildCommand: (importPath, outDir) => [
                    "rustc",
                    "--crate-type",
                    "cdylib",
                    importPath,
                    "--out-dir",
                    outDir
                ],
                outDir: importPath => `build/${basename(importPath)}`,
                parseTypes: async (importPath) => {
                    const sourceCode = await Bun.file(importPath).text();
                    return parseRustTypes(sourceCode);
                }
            }
        );
    }
}
