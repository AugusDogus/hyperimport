import { Language, Parser } from "web-tree-sitter";

// WASM URL for tree-sitter Zig parser
const ZIG_WASM_URL = "https://github.com/tree-sitter-grammars/tree-sitter-zig/releases/download/v1.1.2/tree-sitter-zig.wasm";

// Architecture-specific type mapping
const ARCH_SIZE = process.arch === "x64" || process.arch === "arm64" ? "64" : "32";

// Zig type to FFI type mapping
const TYPE_MAP: Record<string, string> = {
    "void": "T.void",
    "bool": "T.bool",
    "u8": "T.u8",
    "u16": "T.u16",
    "u32": "T.u32",
    "u64": "T.u64",
    "i8": "T.i8",
    "i16": "T.i16",
    "i32": "T.i32",
    "i64": "T.i64",
    "f32": "T.f32",
    "f64": "T.f64",
    "usize": `T.u${ARCH_SIZE}`,
    "isize": `T.i${ARCH_SIZE}`,
    "c_char": "T.i8",
    "c_int": "T.i32",
    "c_uint": "T.u32",
};

function mapType(zigType: string): string {
    return TYPE_MAP[zigType] || "T.ptr";
}

let parserInstance: Parser | null = null;

// Lazy initialization pattern - parser is created only when needed
async function getParser(): Promise<Parser> {
    if (parserInstance) {
        return parserInstance;
    }

    // Initialize tree-sitter WASM
    await Parser.init();
    
    // Fetch and load Zig language WASM
    const response = await fetch(ZIG_WASM_URL);
    const wasmBinary = await response.arrayBuffer();
    const zigLanguage = await Language.load(new Uint8Array(wasmBinary));
    
    // Create and configure parser
    parserInstance = new Parser();
    parserInstance.setLanguage(zigLanguage);
    
    return parserInstance;
}

export interface FunctionType {
    args: string[];
    returns: string;
}

// Parse Zig source code to extract FFI function signatures
// Extracts all functions marked with `pub export`
export async function parseZigTypes(
    sourceCode: string
): Promise<Record<string, FunctionType>> {
    const parser = await getParser();
    const tree = parser.parse(sourceCode);
    
    if (!tree) {
        return {};
    }
    
    const types: Record<string, FunctionType> = {};

    // Traverse all function declarations in the AST
    for (let i = 0; i < tree.rootNode.childCount; i++) {
        const node = tree.rootNode.child(i);
        if (!node || node.type !== "function_declaration") {
            continue;
        }

        // Check if function has `pub export` (required for FFI export)
        // Look for "pub" and "export" keywords in the function children
        const hasPub = node.children.some(child => child?.type === "pub");
        const hasExport = node.children.some(child => child?.type === "export");
        
        if (!hasPub || !hasExport) {
            continue;
        }

        // Get function name (should be after fn keyword)
        const fnNameNode = node.children.find(child => child?.type === "identifier");
        if (!fnNameNode) {
            continue;
        }

        const fnName = fnNameNode.text;
        const args: string[] = [];

        // Parse parameters
        const paramsNode = node.children.find(child => child?.type === "parameters");
        
        if (paramsNode) {
            for (const paramChild of paramsNode.children) {
                if (!paramChild || paramChild.type !== "parameter") {
                    continue;
                }

                // Get the type node (comes after the colon)
                // Look for builtin_type, pointer_type, or identifier (for custom types)
                const typeNode = paramChild.children.find(child => 
                    child?.type === "builtin_type" || 
                    child?.type === "pointer_type"
                );
                
                if (!typeNode) {
                    // Check for custom type identifiers
                    const colonIndex = paramChild.children.findIndex(child => child?.type === ":");
                    if (colonIndex >= 0 && colonIndex < paramChild.children.length - 1) {
                        const possibleType = paramChild.children[colonIndex + 1];
                        if (possibleType?.type === "identifier") {
                            args.push("T.ptr"); // Custom types default to ptr
                            continue;
                        }
                    }
                    args.push("T.ptr");
                    continue;
                }

                // Handle pointer types
                if (typeNode.type === "pointer_type") {
                    // Check if it's a function pointer (contains "fn")
                    if (typeNode.text.includes("fn")) {
                        args.push("T.function");
                    } else {
                        args.push("T.ptr");
                    }
                    continue;
                }

                // Handle primitive types
                args.push(mapType(typeNode.text));
            }
        }

        // Parse return type (comes after parameters, before block)
        let returnType = "T.void";
        const returnTypeNode = node.children.find(child => 
            (child?.type === "builtin_type" || 
             child?.type === "pointer_type" ||
             child?.type === "identifier") &&
            child !== fnNameNode
        );
        
        if (returnTypeNode) {
            if (returnTypeNode.type === "pointer_type") {
                returnType = "T.ptr";
            } else {
                returnType = mapType(returnTypeNode.text);
            }
        }

        types[fnName] = { args, returns: returnType };
    }

    return types;
}

