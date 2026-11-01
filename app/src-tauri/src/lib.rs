mod cli;
mod config;
mod error;
mod fsapi;
mod paths;
mod pending_paths;
mod platform;
mod runtime;

use config::{AppConfig, WindowConfig};
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
    if !saved_geometry_visible(&window, &cfg.window) {
        return;
    }
    let _ = window.set_size(tauri::LogicalSize::new(
        cfg.window.width as f64,
        cfg.window.height as f64,
    ));
    let _ = window.set_position(tauri::LogicalPosition::new(
        cfg.window.x as f64,
        cfg.window.y as f64,
    ));
}

fn saved_geometry_visible(window: &tauri::WebviewWindow, cfg: &WindowConfig) -> bool {
    if cfg.width < 200 || cfg.height < 200 {
        return false;
    }
    let Ok(monitors) = window.available_monitors() else {
        return false;
    };
    let rect = (
        cfg.x as f64,
        cfg.y as f64,
        cfg.width as f64,
        cfg.height as f64,
    );
    monitors.iter().any(|monitor| {
        let scale = monitor.scale_factor();
        let position = monitor.position();
        let size = monitor.size();
        let area = (
            position.x as f64 / scale,
            position.y as f64 / scale,
            size.width as f64 / scale,
            size.height as f64 / scale,
        );
        has_visible_overlap(rect, area)
    })
}

fn has_visible_overlap(a: (f64, f64, f64, f64), b: (f64, f64, f64, f64)) -> bool {
    const MIN_VISIBLE: f64 = 50.0;
    let left = a.0.max(b.0);
    let top = a.1.max(b.1);
    let right = (a.0 + a.2).min(b.0 + b.2);
    let bottom = (a.1 + a.3).min(b.1 + b.3);
    right - left >= MIN_VISIBLE && bottom - top >= MIN_VISIBLE
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
            fsapi::pick_export_path,
            fsapi::write_jpeg,
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

#[cfg(test)]
mod tests {
    use super::has_visible_overlap;

    #[test]
    fn rejects_minimized_window_geometry() {
        let minimized = (-21333.0, -21333.0, 263.0, 291.0);
        assert!(!has_visible_overlap(minimized, (0.0, 0.0, 1280.0, 720.0)));
    }

    #[test]
    fn accepts_geometry_on_secondary_monitor() {
        let secondary = (-1920.0, 0.0, 1920.0, 1080.0);
        assert!(has_visible_overlap(
            (-1800.0, 100.0, 1200.0, 800.0),
            secondary
        ));
    }
}
