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
const vscode = __importStar(require("vscode"));
function activate(context) {
    console.log('[Hyperimport] Extension activated');
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
        console.log(`[Hyperimport] Checking definition for: ${word}`);
        // Check if this is an import from a .rs or .zig file
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
        // Try to find the exact position and range of the function name in the source file
        try {
            const sourceContent = fs.readFileSync(sourceFile, 'utf-8');
            const lines = sourceContent.split('\n');
            const line = lines[lineNumber];
            if (line) {
                // Find the function name in the line
                // Look for the word we're searching for after "fn" or "function"
                const fnNameIndex = line.indexOf(word);
                if (fnNameIndex !== -1) {
                    // Verify it's actually a function name (comes after "fn" or "function")
                    const beforeWord = line.substring(0, fnNameIndex);
                    if (/\b(fn|function)\s+$/.test(beforeWord)) {
                        // Return a range that highlights the function name
                        return new vscode.Location(sourceUri, new vscode.Range(new vscode.Position(lineNumber, fnNameIndex), new vscode.Position(lineNumber, fnNameIndex + word.length)));
                    }
                }
            }
        }
        catch (err) {
            console.log(`[Hyperimport] Could not read source file for precise positioning: ${err}`);
        }
        // Fallback to line start if we couldn't find the exact position
        return new vscode.Location(sourceUri, new vscode.Position(lineNumber, 0));
    }
    findHyperimportImport(document, symbol) {
        const text = document.getText();
        // Look for imports from .rs or .zig files
        const importRegex = /import\s+(?:{[^}]*}|[\w\s,]+)\s+from\s+['"](.*?\.(?:rs|zig))['"]/g;
        let match;
        while ((match = importRegex.exec(text)) !== null) {
            const modulePath = match[1];
            const importStatement = match[0];
            // Check if our symbol is in this import
            if (importStatement.includes(symbol)) {
                return { modulePath };
            }
        }
        return undefined;
    }
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
//# sourceMappingURL=extension.js.map