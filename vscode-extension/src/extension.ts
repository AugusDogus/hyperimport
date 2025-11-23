import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    console.log('[Hyperimport] Extension activated');

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

    private findHyperimportImport(document: vscode.TextDocument, symbol: string): { modulePath: string } | undefined {
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

    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

