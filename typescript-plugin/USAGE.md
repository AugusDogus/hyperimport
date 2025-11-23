# Using the Hyperimport TypeScript Plugin

## Setup

1. **Install hyperimport** (or update to the branch with the plugin):
   ```bash
   bun add hyperimport@github:AugusDogus/hyperimport#typescript-plugin
   ```

2. **Add the plugin to your `tsconfig.json`**:
   ```json
   {
     "compilerOptions": {
       "plugins": [
         {
           "name": "hyperimport/typescript-plugin"
         }
       ]
     }
   }
   ```

3. **Restart your TypeScript server** in VSCode/Cursor:
   - Cmd/Ctrl+Shift+P → "TypeScript: Restart TS Server"

## Testing

1. Import from a Rust or Zig file:
   ```typescript
   import { add } from "./math.rs";
   
   console.log(add(10, 5));
   ```

2. **Ctrl+Click (or F12) on `add`** → Should go directly to `math.rs`!

## Troubleshooting

### Plugin not loading

Check the TypeScript output channel:
- View → Output → Select "TypeScript" from the dropdown
- Look for `[Hyperimport Plugin]` messages

### Still seeing multiple definitions

Make sure you:
1. Restarted the TS server after adding the plugin to tsconfig.json
2. Are using the correct plugin name: `"hyperimport/typescript-plugin"`
3. Have the latest hyperimport version with JSDoc source links

### Plugin errors

If you see errors in the TypeScript output, please report them with:
- The full error message
- Your TypeScript version
- Your tsconfig.json

