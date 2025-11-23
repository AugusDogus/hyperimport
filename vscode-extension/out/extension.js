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
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ts = __importStar(require("typescript"));
const vscode = __importStar(require("vscode"));
function activate(context) {
    console.log('[Hyperimport] Extension activated');
    vscode.window.showInformationMessage('Hyperimport extension is now active!');
    // Set the editor config to skip peek window
    vscode.workspace.getConfiguration().update('editor.gotoLocation.multipleDefinitions', 'goto', vscode.ConfigurationTarget.Global);
    const provider = new HyperimportDefinitionProvider();
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(['typescript', 'javascript'], provider));
}
function deactivate() { }
class HyperimportDefinitionProvider {
    async provideDefinition(document, position, token) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return undefined;
        }
        // Get the word at the cursor position
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }
        const word = document.getText(wordRange);
        console.log(`[Hyperimport] Checking definition for: ${word} at position ${position.line}:${position.character}`);
        // Check if this symbol is imported from a .rs or .zig file
        const importMatch = this.findHyperimportImport(document, word);
        if (!importMatch) {
            console.log(`[Hyperimport] Not a hyperimport symbol`);
            return undefined;
        }
        const { modulePath } = importMatch;
        console.log(`[Hyperimport] Found hyperimport from: ${modulePath}`);
        // Read the config.ts file
        const configPath = path.join(workspaceFolder.uri.fsPath, '@types', path.basename(modulePath), 'config.ts');
        if (!fs.existsSync(configPath)) {
            console.log(`[Hyperimport] Config not found: ${configPath}`);
            return undefined;
        }
        const configContent = fs.readFileSync(configPath, 'utf-8');
        // Look for the JSDoc comment with the source location
        const regex = new RegExp(`\\/\\*\\*\\s*Source:\\s*{@link\\s+file:\\/\\/\\/([^#]+)#L(\\d+)}\\s*\\*\\/\\s*\\n\\s*${this.escapeRegex(word)}\\s*:`, 'g');
        const match = regex.exec(configContent);
        if (!match) {
            console.log(`[Hyperimport] No source location found for ${word}`);
            return undefined;
        }
        const sourceFile = match[1].replace(/\//g, path.sep);
        const lineNumber = parseInt(match[2], 10) - 1; // Convert to 0-based
        console.log(`[Hyperimport] Redirecting to ${sourceFile}:${lineNumber + 1}`);
        const sourceUri = vscode.Uri.file(sourceFile);
        return new vscode.Location(sourceUri, new vscode.Position(lineNumber, 0));
    }
    findHyperimportImport(document, symbol) {
        const text = document.getText();
        // Parse the document as TypeScript/JavaScript using TypeScript's AST
        const sourceFile = ts.createSourceFile(document.fileName, text, ts.ScriptTarget.Latest, true);
        // Walk through all import declarations
        for (const statement of sourceFile.statements) {
            if (!ts.isImportDeclaration(statement)) {
                continue;
            }
            // Get the module specifier (e.g., "./math.rs")
            const moduleSpecifier = statement.moduleSpecifier;
            if (!ts.isStringLiteral(moduleSpecifier)) {
                continue;
            }
            const modulePath = moduleSpecifier.text;
            // Only handle .rs and .zig files
            if (!modulePath.endsWith('.rs') && !modulePath.endsWith('.zig')) {
                continue;
            }
            // Check if the import has named bindings (e.g., { add, mul, sub })
            const importClause = statement.importClause;
            if (!importClause || !importClause.namedBindings) {
                continue;
            }
            // Handle named imports
            if (ts.isNamedImports(importClause.namedBindings)) {
                for (const element of importClause.namedBindings.elements) {
                    const importedName = element.name.text;
                    // Check if this is the symbol we're looking for
                    if (importedName === symbol) {
                        console.log(`[Hyperimport] Found ${symbol} imported from ${modulePath}`);
                        return { modulePath };
                    }
                }
            }
        }
        return undefined;
    }
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
//# sourceMappingURL=extension.js.map