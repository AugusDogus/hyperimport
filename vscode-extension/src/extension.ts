import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('[Hyperimport] Extension activated');
    vscode.window.showInformationMessage('Hyperimport extension is now active!');

    // Set the editor config to skip peek window
    vscode.workspace.getConfiguration().update(
        'editor.gotoLocation.multipleDefinitions',
        'goto',
        vscode.ConfigurationTarget.Global
    );

    const provider = new HyperimportDefinitionProvider();
    
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            ['typescript', 'javascript'],
            provider
        )
    );
}

export function deactivate() {}

class HyperimportDefinitionProvider implements vscode.DefinitionProvider {
    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Definition | undefined> {
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
        const configPath = path.join(
            workspaceFolder.uri.fsPath,
            '@types',
            path.basename(modulePath),
            'config.ts'
        );

        if (!fs.existsSync(configPath)) {
            console.log(`[Hyperimport] Config not found: ${configPath}`);
            return undefined;
        }

        const configContent = fs.readFileSync(configPath, 'utf-8');
        
        // Look for the JSDoc comment with the source location
        const regex = new RegExp(
            `\\/\\*\\*\\s*Source:\\s*{@link\\s+file:\\/\\/\\/([^#]+)#L(\\d+)}\\s*\\*\\/\\s*\\n\\s*${this.escapeRegex(word)}\\s*:`,
            'g'
        );
        
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

    private findHyperimportImport(
        document: vscode.TextDocument, 
        symbol: string
    ): { modulePath: string } | undefined {
        const text = document.getText();
        
        // Parse the document as TypeScript/JavaScript using TypeScript's AST
        const sourceFile = ts.createSourceFile(
            document.fileName,
            text,
            ts.ScriptTarget.Latest,
            true
        );

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

    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

