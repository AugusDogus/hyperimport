import { BunPlugin } from "bun";
import { FFIFunction, dlopen, suffix } from "bun:ffi";
import { mkdirSync, readFileSync } from "fs";
import { basename, parse } from "path";
import { LoaderConfig } from "./types";
import { lastModified } from "./utils";

export default class {
    /**The name of the loader. */
    name: string;
    protected cwd: string;
    protected _config: LoaderConfig.Builder;
    // @ts-expect-error
    protected config: LoaderConfig.Internal = {};

    constructor(name: string, config: LoaderConfig.Builder) {
        this.name = name;
        this.cwd = process.cwd();
        this._config = config;
    }

    /**
     * To build the source file into a shared library file.
     */
    async build() {
        Bun.spawnSync(this.config.buildCommand);
    }

    /**
     * Runs at the beginning of `initConfig()`.
     * By default asks for the build command and output directory from the user on importing the source file for the first time.
     */
    async initConfigPre() {
        // In test mode, automatically use defaults without prompting
        if (process.env.NODE_ENV === "test") {
            console.log(`\x1b[33m[HYPERIMPORT]\x1b[39m: ${this.name}\nNo configuration was found for "${this.config.importPath}"\nUsing default configuration (test mode)...\n`);
            mkdirSync(this.config.outDir, { recursive: true });
            return;
        }

        console.log(`\x1b[33m[HYPERIMPORT]\x1b[39m: ${this.name}\nNo configuration was found for "${this.config.importPath}"\nEnter the build command and output directory to configure it.\nPress enter to use the default values.\n`);
        this.config.buildCommand = prompt("build command: (default)")?.split(" ") ?? this.config.buildCommand;
        this.config.outDir = prompt(`output directory: (${this.config.outDir})`) ?? this.config.outDir;
        mkdirSync(this.config.outDir, { recursive: true });
    }

    /**
     * Generates `config.ts` and `types.d.ts` to add type completions for the source file.
     */
    async initConfigTypes() {
        const filename = basename(this.config.importPath);
        const configDir = `${this.cwd}/@types/${filename}`;
        mkdirSync(configDir, { recursive: true });
        Bun.write(`${configDir}/lastModified`, lastModified(this.config.importPath));
        
        const configWriter = Bun.file(`${configDir}/config.ts`).writer();
        configWriter.write(`import type { LoaderConfig } from "hyperimport";\nimport { T } from "hyperimport";\nexport default {\n\tbuildCommand: ${JSON.stringify(this.config.buildCommand)},\n\toutDir: "${this.config.outDir}",\n\tsymbols: {`);
        
        const types = this._config.parseTypes ? await this._config.parseTypes(this.config.importPath) : undefined;
        
        if (types && Object.keys(types).length > 0) {
            for (const [symbol, type] of Object.entries(types)) {
                const args = type.args.join(", ");
                if (type.line) {
                    // Convert Windows backslashes to forward slashes for proper file:// URL
                    const filePath = this.config.importPath.replace(/\\/g, '/');
                    configWriter.write(`\n\t\t/** Source: {@link file:///${filePath}#L${type.line}} */`);
                }
                configWriter.write(`\n\t\t${symbol}: {\n\t\t\targs: [${args}],\n\t\t\treturns: ${type.returns}\n\t\t},`);
            }
        }
        configWriter.write(`\n\t}\n} satisfies LoaderConfig.Main;`);
        await configWriter.end();
        
        // Generate types.d.ts - simplified since JSDoc is in config.ts
        await Bun.write(
            `${this.cwd}/@types/${filename}/types.d.ts`,
            `declare module "*/${filename}" {\n\tconst symbols: import("bun:ffi").ConvertFns<typeof import("./config.ts").default.symbols>;\n\texport = symbols;\n}`
        );
        console.log(`\n\x1b[32mConfig file has been generated at "${this.cwd}/@types/${filename}/config.ts"\x1b[39m\nTypes have been automatically generated!`);
    }

    /**
     * When the source file isn't configured yet, this executes to configure it.
     */
    async initConfig() {
        await this.initConfigPre();
        console.log("\nBuilding the source file...");
        await this.build();
        console.log("The source file has been built.");
        await this.initConfigTypes();
    }

    /**
     * Checks if the source file was modified, if it is, then `build()` is executed to rebuild the changed source file.
     */
    async ifSourceModify() {
        const lm = lastModified(this.config.importPath);
        const lmfile = `${this.cwd}/@types/${basename(this.config.importPath)}/lastModified`;
        if (lm !== readFileSync(lmfile).toString()) {
            await this.build();
            await this.initConfigTypes();
            Bun.write(lmfile, lm);
        }
    }

    /**
     * Imports the symbols defined in `config.ts` to be used when opening the shared library.
     * If `config.ts` doesn't exist, generates it automatically with type inference.
     * @returns An object containing the symbols.
     */
    async getSymbols(): Promise<Record<string, FFIFunction>> {
        try {
            await this.ifSourceModify();
            return (await import(`${this.cwd}/@types/${basename(this.config.importPath)}/config.ts`)).default.symbols;
        } catch {
            await this.initConfig();
            // Config generated, now import and return it
            return (await import(`${this.cwd}/@types/${basename(this.config.importPath)}/config.ts`)).default.symbols;
        }
    }

    /**
     * Runs just before opening/loading the shared library.
     */
    async preload() {
        this.config.outDir = this._config.outDir!(this.config.importPath);
        this.config.buildCommand = this._config.buildCommand!(this.config.importPath, this.config.outDir);
        const libPrefix = process.platform === "win32" ? "" : "lib";
        this.config.libPath = `${this.config.outDir}/${libPrefix}${parse(this.config.importPath).name}.${suffix}`;
    }

    /**
     * Creates the plugin instance to be consumed by `Bun.plugin()` to register it.
     * @returns A `BunPlugin` instance.
     */
    async toPlugin(): Promise<BunPlugin> {
        const parentThis = this;
        return {
            name: parentThis.name,
            setup(build) {
                build.onLoad({ filter: new RegExp(`\.(${parentThis._config.extension})$`) }, async args => {
                    parentThis.config.importPath = args.path;
                    await parentThis.preload();
                    return {
                        exports: dlopen(parentThis.config.libPath, await parentThis.getSymbols()).symbols,
                        loader: "object"
                    };
                });
            }
        };
    }

}