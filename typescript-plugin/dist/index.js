"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
function findNodeAtPosition(ts, sourceFile, position) {
    function find(node) {
        if (position >= node.getStart() && position < node.getEnd()) {
            return ts.forEachChild(node, find) || node;
        }
        return undefined;
    }
    return find(sourceFile);
}
function findParentImportDeclaration(ts, node) {
    let current = node;
    while (current) {
        if (ts.isImportDeclaration(current)) {
            return current;
        }
        current = current.parent;
    }
    return undefined;
}
function getHyperimportSourceLocation(projectDir, moduleSpecifier, symbolName, logger) {
    try {
        const modulePath = path.resolve(projectDir, moduleSpecifier);
        const filename = path.basename(modulePath);
        const configPath = path.join(projectDir, '@types', filename, 'config.ts');
        if (!fs.existsSync(configPath)) {
            logger.info(`[Hyperimport Plugin] Config not found: ${configPath}`);
            return undefined;
        }
        const configContent = fs.readFileSync(configPath, 'utf-8');
        const regex = new RegExp(`\\/\\*\\*\\s*Source:\\s*{@link\\s+file:\\/\\/\\/([^#]+)#L(\\d+)}\\s*\\*\\/\\s*\\n\\s*${symbolName}\\s*:`, 'g');
        const match = regex.exec(configContent);
        if (!match) {
            logger.info(`[Hyperimport Plugin] No source location found for ${symbolName}`);
            return undefined;
        }
        return {
            file: match[1].replace(/\//g, path.sep),
            line: parseInt(match[2], 10)
        };
    }
    catch (error) {
        logger.info(`[Hyperimport Plugin] Error parsing config: ${error}`);
        return undefined;
    }
}
module.exports = function init({ typescript: ts }) {
    function create(info) {
        const logger = info.project.projectService.logger;
        logger.info('[Hyperimport Plugin] Initializing...');
        // Proxy the language service
        const proxy = Object.create(null);
        for (const k of Object.keys(info.languageService)) {
            const x = info.languageService[k];
            // @ts-ignore
            proxy[k] = (...args) => x.apply(info.languageService, args);
        }
        // Override getDefinitionAtPosition
        proxy.getDefinitionAtPosition = (fileName, position) => {
            logger.info(`[Hyperimport Plugin] getDefinitionAtPosition called for ${fileName}:${position}`);
            const prior = info.languageService.getDefinitionAtPosition(fileName, position);
            logger.info(`[Hyperimport Plugin] Prior definitions: ${prior?.length || 0}`);
            try {
                const program = info.languageService.getProgram();
                if (!program)
                    return prior;
                const sourceFile = program.getSourceFile(fileName);
                if (!sourceFile)
                    return prior;
                const node = findNodeAtPosition(ts, sourceFile, position);
                if (!node || !ts.isIdentifier(node))
                    return prior;
                const symbol = program.getTypeChecker().getSymbolAtLocation(node);
                if (!symbol)
                    return prior;
                const declarations = symbol.getDeclarations();
                if (!declarations || declarations.length === 0)
                    return prior;
                for (const decl of declarations) {
                    if (ts.isImportSpecifier(decl.parent) || ts.isImportClause(decl.parent)) {
                        const importDecl = findParentImportDeclaration(ts, decl);
                        if (!importDecl || !importDecl.moduleSpecifier)
                            continue;
                        const moduleSpecifier = importDecl.moduleSpecifier.text;
                        if (!moduleSpecifier.match(/\.(rs|zig)$/))
                            continue;
                        logger.info(`[Hyperimport Plugin] Found hyperimport symbol: ${node.text} from ${moduleSpecifier}`);
                        const sourceLocation = getHyperimportSourceLocation(path.dirname(fileName), moduleSpecifier, node.text, logger);
                        if (sourceLocation) {
                            logger.info(`[Hyperimport Plugin] Resolved to: ${sourceLocation.file}:${sourceLocation.line}`);
                            const hyperimportDef = {
                                kind: ts.ScriptElementKind.functionElement,
                                name: node.text,
                                containerKind: ts.ScriptElementKind.moduleElement,
                                containerName: path.basename(sourceLocation.file),
                                textSpan: {
                                    start: 0,
                                    length: node.text.length
                                },
                                fileName: sourceLocation.file,
                                contextSpan: undefined
                            };
                            // Return ONLY the Rust/Zig source
                            return [hyperimportDef];
                        }
                    }
                }
            }
            catch (error) {
                logger.info(`[Hyperimport Plugin] Error: ${error}`);
            }
            return prior;
        };
        logger.info('[Hyperimport Plugin] Initialized successfully');
        return proxy;
    }
    return { create };
};
