import { CString, JSCallback } from "bun:ffi";
import { expect, test } from "bun:test";
import { captureStderr, captureStdout } from "./capture-output";

const testCases = [
  {
    name: "rust",
    lib: "test.rs",
    importPath: "./test.rs",
  },
  {
    name: "zig",
    lib: "test.zig",
    importPath: "./test.zig",
  },
];

for (const { name, lib, importPath } of testCases) {
  const { add, sub, mul, not, print_stdout, print_stderr, echo, call } = await import(importPath);

  test(`${name}: add function`, () => {
    expect(add(3, 2)).toBe(5);
  });

  test(`${name}: sub function`, () => {
    expect(sub(3, 2)).toBe(1);
  });

  test(`${name}: mul function`, () => {
    expect(mul(3.2, 2.1)).toBeCloseTo(6.72, 1);
  });

  test(`${name}: not function`, () => {
    expect(not(true)).toBe(false);
    expect(not(false)).toBe(true);
  });

  test(`${name}: print to stdout`, async () => {
    const libPrefix = process.platform === "win32" ? "" : "lib";
    const libExt = process.platform === "win32" ? "dll" : process.platform === "darwin" ? "dylib" : "so";
    
    const output = await captureStdout(`
      import { dlopen, FFIType } from "bun:ffi";
      const { symbols } = dlopen("./build/${lib}/${libPrefix}test.${libExt}", {
        print_stdout: { args: [], returns: FFIType.void }
      });
      symbols.print_stdout();
    `);
    
    expect(output).toBe("stdout message");
  });

  test(`${name}: print to stderr`, async () => {
    const libPrefix = process.platform === "win32" ? "" : "lib";
    const libExt = process.platform === "win32" ? "dll" : process.platform === "darwin" ? "dylib" : "so";
    
    const output = await captureStderr(`
      import { dlopen, FFIType } from "bun:ffi";
      const { symbols } = dlopen("./build/${lib}/${libPrefix}test.${libExt}", {
        print_stderr: { args: [], returns: FFIType.void }
      });
      symbols.print_stderr();
    `);
    
    expect(output).toBe("stderr message");
  });

  test(`${name}: echo function (pointer parameter)`, async () => {
    const libPrefix = process.platform === "win32" ? "" : "lib";
    const libExt = process.platform === "win32" ? "dll" : process.platform === "darwin" ? "dylib" : "so";
    
    const output = await captureStdout(`
      import { dlopen, FFIType, ptr } from "bun:ffi";
      const { symbols } = dlopen("./build/${lib}/${libPrefix}test.${libExt}", {
        echo: { args: [FFIType.ptr], returns: FFIType.void }
      });
      symbols.echo(ptr(Buffer.from("hello from JS\\0", "utf-8")));
    `);
    
    expect(output).toBe("hello from JS");
  });

  test(`${name}: call function with callback`, () => {
    const callback = new JSCallback(
      (ptr, length) => /Hello/.test(new CString(ptr, length).toString()),
      {
        returns: "bool",
        args: ["ptr", "usize"]
      }
    );
    
    expect(call(callback)).toBe(true);
  });
}

