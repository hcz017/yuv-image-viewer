mod cli;
mod config;
mod error;
mod fsapi;
mod paths;
mod pending_paths;
mod platform;
mod runtime;

use config::AppConfig;
use error::{FsError, FsErrorKind};
use pending_paths::PendingPaths;
use std::fs;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager};

pub struct ReadyState(AtomicBool);

#[tauri::command]
fn signal_ready(state: tauri::State<ReadyState>) -> bool {
    state.0.store(true, Ordering::SeqCst);
    true
}

#[tauri::command]
fn take_pending_paths(state: tauri::State<PendingPaths>) -> Vec<Vec<String>> {
    state.take_all()
}

#[tauri::command]
fn platform_info(app: tauri::AppHandle) -> platform::PlatformInfo {
    platform::info(&app)
}

fn load_config_file(app: &tauri::AppHandle) -> Result<AppConfig, FsError> {
    let candidates = platform::config_store::candidates(app);
    for (path, location) in &candidates {
        if !path.exists() {
            continue;
        }
        let bytes = fs::read(path).map_err(|err| FsError::from_io(err, path))?;
        let mut cfg: AppConfig = serde_json::from_slice(&bytes).unwrap_or_default();
        cfg.store_location = (*location).to_string();
        return Ok(cfg);
    }

    let mut cfg = AppConfig::default();
    cfg.store_location = candidates
        .first()
        .map(|(_, location)| (*location).to_string())
        .unwrap_or_default();
    Ok(cfg)
}

#[tauri::command]
fn load_config(app: tauri::AppHandle) -> Result<AppConfig, FsError> {
    load_config_file(&app)
}

#[tauri::command]
fn save_config(app: tauri::AppHandle, mut cfg: AppConfig) -> Result<(), FsError> {
    let (path, location) = platform::config_store::choose_writable(&app)
        .map_err(|message| FsError::new(FsErrorKind::Io, message))?;
    cfg.store_location = location.to_string();

    let bytes = serde_json::to_vec_pretty(&cfg)
        .map_err(|err| FsError::new(FsErrorKind::Io, err.to_string()))?;
    platform::config_store::atomic_write(&path, &bytes)
        .map_err(|message| FsError::new(FsErrorKind::Io, message))
}

fn restore_window(app: &tauri::AppHandle) {
    let Ok(cfg) = load_config_file(app) else {
        return;
    };
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let _ = window.set_size(tauri::LogicalSize::new(
        cfg.window.width as f64,
        cfg.window.height as f64,
    ));
    let _ = window.set_position(tauri::LogicalPosition::new(
        cfg.window.x as f64,
        cfg.window.y as f64,
    ));
}

pub fn run() {
    #[cfg(target_os = "windows")]
    if !runtime::ensure_webview2() {
        std::process::exit(1);
    }

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(ReadyState(AtomicBool::new(false)))
        .manage(PendingPaths::default());

    #[cfg(any(target_os = "windows", target_os = "linux"))]
    let builder = builder.plugin(tauri_plugin_single_instance::init(
        |app, argv, _cwd| {
            let paths = cli::parse_open_args(argv.into_iter().skip(1));
            if paths.is_empty() {
                return;
            }
            app.state::<PendingPaths>().push(paths);
            let _ = app.emit("open-paths", ());
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        },
    ));

    let app = builder
        .setup(|app| {
            let startup_paths = cli::parse_open_args(std::env::args().skip(1));
            app.state::<PendingPaths>().push(startup_paths);
            restore_window(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            fsapi::list_volumes,
            fsapi::list_dir_entries,
            fsapi::stat_path,
            fsapi::reveal_path,
            fsapi::read_file_bytes,
            fsapi::pick_files,
            fsapi::pick_directory,
            platform_info,
            load_config,
            save_config,
            take_pending_paths,
            signal_ready,
        ])
        .build(tauri::generate_context!())
        .expect("启动 Tauri 应用失败");

    app.run(|app_handle, event| {
        #[cfg(target_os = "macos")]
        {
            if let tauri::RunEvent::Opened { urls } = event {
                let paths: Vec<String> = urls
                    .iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .map(|path| path.to_string_lossy().to_string())
                    .collect();
                if !paths.is_empty() {
                    app_handle.state::<PendingPaths>().push(paths);
                    let _ = app_handle.emit("open-paths", ());
                }
            }
        }
        #[cfg(not(target_os = "macos"))]
        {
            let _ = (app_handle, event);
        }
    });
}
