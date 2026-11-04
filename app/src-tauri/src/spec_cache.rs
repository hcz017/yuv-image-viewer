use crate::error::{FsError, FsErrorKind};
use crate::platform::config_store;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, State};

const CACHE_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpecCacheEntry {
    pub path: String,
    pub size: u64,
    pub modified_ms: u64,
    pub width: u32,
    pub height: u32,
    pub stride: u32,
    pub scanline: u32,
    pub format: String,
    pub updated_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpecCache {
    pub version: u32,
    #[serde(default)]
    pub entries: Vec<SpecCacheEntry>,
}

impl Default for SpecCache {
    fn default() -> Self {
        Self {
            version: CACHE_VERSION,
            entries: Vec::new(),
        }
    }
}

/// 串行化缓存写入，避免并发保存相互覆盖。
pub struct SpecCacheLock(pub Mutex<()>);

fn cache_path(app: &AppHandle) -> Result<PathBuf, String> {
    let (config_path, _) = config_store::choose_writable(app)?;
    config_path
        .parent()
        .map(|dir| dir.join("spec-cache.json"))
        .ok_or_else(|| "缓存路径没有父目录".to_string())
}

#[tauri::command]
pub fn load_spec_cache(app: AppHandle) -> Result<SpecCache, FsError> {
    let path = cache_path(&app).map_err(|message| FsError::new(FsErrorKind::Io, message))?;
    if !path.exists() {
        return Ok(SpecCache::default());
    }

    let bytes = fs::read(&path).map_err(|err| FsError::from_io(err, &path))?;
    let cache: SpecCache = serde_json::from_slice(&bytes).unwrap_or_default();
    if cache.version != CACHE_VERSION {
        return Ok(SpecCache::default());
    }
    Ok(cache)
}

#[tauri::command]
pub fn save_spec_cache(
    app: AppHandle,
    mut cache: SpecCache,
    lock: State<'_, SpecCacheLock>,
) -> Result<(), FsError> {
    cache.version = CACHE_VERSION;
    let _guard = lock
        .0
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());

    let path = cache_path(&app).map_err(|message| FsError::new(FsErrorKind::Io, message))?;
    let bytes = serde_json::to_vec_pretty(&cache)
        .map_err(|err| FsError::new(FsErrorKind::Io, err.to_string()))?;
    config_store::atomic_write_with_prefix(&path, &bytes, ".spec-cache")
        .map_err(|message| FsError::new(FsErrorKind::Io, message))
}
