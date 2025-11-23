import { Language, Parser } from "web-tree-sitter";

// WASM URL for tree-sitter Rust parser
const RUST_WASM_URL = "https://github.com/tree-sitter/tree-sitter-rust/releases/download/v0.24.0/tree-sitter-rust.wasm";

// Architecture-specific type mapping
const ARCH_SIZE = process.arch === "x64" || process.arch === "arm64" ? "64" : "32";

// Rust type to FFI type mapping
const TYPE_MAP: Record<string, string> = {
    "()": "T.void",
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
    "char": "T.u32",
};

function mapType(rustType: string): string {
    return TYPE_MAP[rustType] || "T.ptr";
}

let parserInstance: Parser | null = null;

// Lazy initialization pattern - parser is created only when needed
async function getParser(): Promise<Parser> {
    if (parserInstance) {
        return parserInstance;
    }

    // Initialize tree-sitter WASM
    await Parser.init();
    
    // Fetch and load Rust language WASM
    const response = await fetch(RUST_WASM_URL);
    const wasmBinary = await response.arrayBuffer();
    const rustLanguage = await Language.load(new Uint8Array(wasmBinary));
    
    // Create and configure parser
    parserInstance = new Parser();
    parserInstance.setLanguage(rustLanguage);
    
    return parserInstance;
}

export interface FunctionType {
    args: string[];
    returns: string;
    line?: number;
}

// Parse Rust source code to extract FFI function signatures
// Extracts all #[no_mangle] extern "C" functions
export async function parseRustTypes(
    sourceCode: string
): Promise<Record<string, FunctionType>> {
    const parser = await getParser();
    const tree = parser.parse(sourceCode);
    
    if (!tree) {
        return {};
    }
    
    const types: Record<string, FunctionType> = {};

    // Traverse all function items in the AST
    for (let i = 0; i < tree.rootNode.childCount; i++) {
        const node = tree.rootNode.child(i);
        if (!node || node.type !== "function_item") {
            continue;
        }

        // Check if function has #[no_mangle] attribute (required for FFI export)
        const prevSibling = i > 0 ? tree.rootNode.child(i - 1) : null;
        const hasNoMangle = prevSibling?.type === "attribute_item" && 
                           prevSibling.text.includes("no_mangle");
        
        if (!hasNoMangle) {
            continue;
        }

        // Get function name
        const fnNameNode = node.children.find(child => child?.type === "identifier");
        if (!fnNameNode) {
            continue;
        }

        const fnName = fnNameNode.text;

        // Parse parameters
        const parametersNode = node.children.find(child => child?.type === "parameters");
        const args: string[] = [];

        if (parametersNode) {
            for (const paramChild of parametersNode.children) {
                if (!paramChild || paramChild.type !== "parameter") {
                    continue;
                }

                // Check for primitive types
                const primitiveType = paramChild.children.find(child => child?.type === "primitive_type");
                if (primitiveType) {
                    args.push(mapType(primitiveType.text));
                    continue;
                }

                // Check for pointer types
                const pointerType = paramChild.children.find(child => child?.type === "pointer_type");
                if (pointerType) {
                    args.push("T.ptr");
                    continue;
                }

                // Check for reference types
                const referenceType = paramChild.children.find(child => child?.type === "reference_type");
                if (referenceType) {
                    args.push("T.ptr");
                    continue;
                }

                // Check for function types (callbacks)
                const functionType = paramChild.children.find(child => child?.type === "function_type");
                if (functionType) {
                    args.push("T.function");
                    continue;
                }

                // Default to pointer for unknown types
                args.push("T.ptr");
            }
        }

        // Parse return type
        let returnType = "T.void";
        const primitiveReturn = node.children.find(child => child?.type === "primitive_type");
        if (primitiveReturn) {
            returnType = mapType(primitiveReturn.text);
        } else {
            const unitReturn = node.children.find(child => child?.type === "unit_type");
            if (unitReturn) {
                returnType = "T.void";
            } else {
                // Check for pointer return types
                const pointerReturn = node.children.find(child => child?.type === "pointer_type");
                if (pointerReturn) {
                    returnType = "T.ptr";
                }
            }
        }

        types[fnName] = { 
            args, 
            returns: returnType,
            line: fnNameNode.startPosition.row + 1
        };
    }

    return types;
}
