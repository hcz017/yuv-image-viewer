use crate::error::FsError;
use crate::paths::{is_supported_path, require_absolute, SUPPORTED_EXTENSIONS};
use crate::platform::volumes::{self, VolumeInfo};
use serde::Serialize;
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;
use tauri_plugin_dialog::DialogExt;

#[derive(Debug, Clone, Serialize)]
pub struct EntryInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified_ms: u64,
}

fn entry_info(path: &Path) -> Result<EntryInfo, FsError> {
    let meta = fs::metadata(path).map_err(|err| FsError::from_io(err, path))?;
    let modified_ms = meta
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0);

    Ok(EntryInfo {
        name: path
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_else(|| path.to_string_lossy().to_string()),
        path: path.to_string_lossy().to_string(),
        is_dir: meta.is_dir(),
        size: meta.len(),
        modified_ms,
    })
}

#[tauri::command]
pub fn list_volumes() -> Vec<VolumeInfo> {
    volumes::list()
}

#[tauri::command]
pub fn list_dir_entries(path: String) -> Result<Vec<EntryInfo>, FsError> {
    let dir = require_absolute(&path)?;
    let meta = fs::metadata(&dir).map_err(|err| FsError::from_io(err, &dir))?;
    if !meta.is_dir() {
        return Err(FsError::not_supported(&dir));
    }

    let entries = fs::read_dir(&dir).map_err(|err| FsError::from_io(err, &dir))?;
    let mut result = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(info) = entry_info(&path) else { continue };
        if info.is_dir || is_supported_path(&path) {
            result.push(info);
        }
    }
    Ok(result)
}

#[tauri::command]
pub fn stat_path(path: String) -> Result<EntryInfo, FsError> {
    let target = require_absolute(&path)?;
    let info = entry_info(&target)?;
    if !info.is_dir && !is_supported_path(&target) {
        return Err(FsError::not_supported(&target));
    }
    Ok(info)
}

#[tauri::command]
pub async fn read_file_bytes(path: String) -> Result<tauri::ipc::Response, FsError> {
    let target = require_absolute(&path)?;
    if !is_supported_path(&target) {
        return Err(FsError::not_supported(&target));
    }
    let bytes = fs::read(&target).map_err(|err| FsError::from_io(err, &target))?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
pub async fn pick_files(app: tauri::AppHandle) -> Result<Vec<String>, FsError> {
    let picked = app
        .dialog()
        .file()
        .add_filter("YUV Images", &SUPPORTED_EXTENSIONS)
        .blocking_pick_files();
    Ok(picked
        .unwrap_or_default()
        .into_iter()
        .filter_map(|file| file.into_path().ok())
        .map(|path| path.to_string_lossy().to_string())
        .collect())
}

#[tauri::command]
pub async fn pick_directory(app: tauri::AppHandle) -> Result<Option<String>, FsError> {
    Ok(app
        .dialog()
        .file()
        .blocking_pick_folder()
        .and_then(|file| file.into_path().ok())
        .map(|path| path.to_string_lossy().to_string()))
}
