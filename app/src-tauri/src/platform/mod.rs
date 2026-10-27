pub mod config_store;
pub mod volumes;

use serde::Serialize;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize)]
pub struct PlatformInfo {
    pub os: String,
    pub path_separator: String,
    pub case_insensitive_paths: bool,
    pub volume_root_label: String,
    pub modifier_label: String,
    pub config_location: String,
    pub app_data_dir: String,
}

pub fn app_data_dir(app: &AppHandle) -> String {
    app.path()
        .app_config_dir()
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_default()
}

pub fn info(app: &AppHandle) -> PlatformInfo {
    let os = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    };

    let config_location = config_store::candidates(app)
        .into_iter()
        .map(|(path, _)| path)
        .find(|path| path.exists())
        .or_else(|| config_store::candidates(app).into_iter().next().map(|(path, _)| path))
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_default();

    PlatformInfo {
        os: os.to_string(),
        path_separator: if cfg!(target_os = "windows") {
            "\\".to_string()
        } else {
            "/".to_string()
        },
        case_insensitive_paths: !cfg!(target_os = "linux"),
        volume_root_label: "此电脑".to_string(),
        modifier_label: if cfg!(target_os = "macos") {
            "Cmd".to_string()
        } else {
            "Ctrl".to_string()
        },
        config_location,
        app_data_dir: app_data_dir(app),
    }
}
