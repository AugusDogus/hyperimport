const std = @import("std");

pub export fn add(a: i32, b: i32) i32 {
    return a + b;
}

pub export fn sub(a: i32, b: i32) i32 {
    return a - b;
}

pub export fn mul(a: f32, b: f32) f32 {
    return a * b;
}

pub export fn not(a: bool) bool {
    return !a;
}

pub export fn print_stdout() void {
    const stdout = std.io.getStdOut().writer();
    stdout.print("stdout message\n", .{}) catch unreachable;
}

pub export fn print_stderr() void {
    std.debug.print("stderr message\n", .{});
}

pub export fn echo(c_string: [*:0]const u8) void {
    const stdout = std.io.getStdOut().writer();
    stdout.print("{s}\n", .{c_string}) catch unreachable;
}

pub export fn call(callback: *const fn ([*]const u8, usize) callconv(.C) bool) bool {
    const string = "Hello, world!";
    return callback(string.ptr, string.len);
}

