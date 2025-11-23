# TypeScript Plugin for Hyperimport

A TypeScript Language Service Plugin that enables "Go to Definition" to jump directly to Rust/Zig source files when using hyperimport.

## How It Works

This plugin hooks into TypeScript's language service and intercepts "Go to Definition" requests. When you Ctrl+Click on a function imported from a `.rs` or `.zig` file, it:

1. Detects that the symbol is from a hyperimport module
2. Reads the generated `@types/{filename}/config.ts`
3. Extracts the source location from the JSDoc comment
4. Returns ONLY the Rust/Zig source location (filters out TypeScript's config.ts definitions)

This gives you the same seamless experience as tRPC!

## Installation

The plugin is automatically included with hyperimport. To enable it, add it to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "typescript-plugin-hyperimport"
      }
    ]
  }
}
```

## Usage

Once configured:

1. Import from a Rust or Zig file:
   ```typescript
   import { add } from "./math.rs";
   ```

2. Ctrl+Click (or F12) on `add` → **Goes directly to `math.rs` at the function definition!**

No more navigating through TypeScript config files!

## Requirements

- TypeScript 4.0 or higher
- Hyperimport with JSDoc source links (automatically included in recent versions)

## Development

```bash
cd typescript-plugin
bun install
bun run build
```

## How It Differs from VSCode Extension

- **VSCode Extension**: Adds additional definitions alongside TypeScript's
- **TypeScript Plugin**: Replaces TypeScript's definitions entirely

The plugin approach gives a much cleaner UX since you only see the Rust/Zig source.

