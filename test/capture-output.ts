import { dirname } from "path";

export async function captureStdout(script: string): Promise<string> {
  const proc = Bun.spawn(["bun", "-e", script], {
    cwd: dirname(import.meta.dir), // Run from project root where builds are
    stdout: "pipe",
    stderr: "pipe",
  });
  
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  await proc.exited;
  
  // If there's any unexpected stderr, throw it
  if (stderr.trim()) {
    throw new Error(`Unexpected stderr: ${stderr.trim()}`);
  }
  
  return stdout.trim();
}

export async function captureStderr(script: string): Promise<string> {
  const proc = Bun.spawn(["bun", "-e", script], {
    cwd: dirname(import.meta.dir), // Run from project root where builds are
    stdout: "pipe",
    stderr: "pipe",
  });
  
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  await proc.exited;
  
  // If there's any unexpected stdout, throw it
  if (stdout.trim()) {
    throw new Error(`Unexpected stdout: ${stdout.trim()}`);
  }
  
  return stderr.trim();
}

