use std::os::raw::c_char;

#[no_mangle]
pub extern "C" fn add(a: u32, b: u32) -> u32 {
    a + b
}

#[no_mangle]
pub extern "C" fn sub(a: i32, b: i32) -> i32 {
    a - b
}

#[no_mangle]
pub extern "C" fn mul(a: f32, b: f32) -> f32 {
    a * b
}

#[no_mangle]
pub extern "C" fn not(a: bool) -> bool {
    !a
}

#[no_mangle]
pub extern "C" fn print_stdout() -> () {
    println!("stdout message");
}

#[no_mangle]
pub extern "C" fn print_stderr() -> () {
    eprintln!("stderr message");
}

#[no_mangle]
pub extern "C" fn echo(c_string: *const c_char) -> () {
    let rust_str = unsafe {
        std::ffi::CStr::from_ptr(c_string).to_str().unwrap()
    };
    println!("{}", rust_str);
}

#[no_mangle]
pub extern "C" fn call(callback: extern fn(*const u8, usize) -> bool) -> bool {
    const string: &str = "Hello, world!";
    callback(string.as_ptr(), string.len())
}

