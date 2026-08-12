// Prevents an additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// Prebuilt libsodium (via tauri-plugin-stronghold) emits MSVC LNK4099/LNK4098
// on Windows debug links; allow until upstream ships matching PDBs/CRT.
#![cfg_attr(all(windows, target_env = "msvc"), allow(linker_messages))]

fn main() {
    app_lib::run();
}
