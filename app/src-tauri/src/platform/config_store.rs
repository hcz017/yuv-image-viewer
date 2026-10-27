use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

pub fn candidates(app: &AppHandle) -> Vec<(PathBuf, &'static str)> {
    let mut result = Vec::new();

    #[cfg(target_os = "windows")]
    {
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                result.push((dir.join("config.json"), "exe"));
            }
        }
    }

    if let Ok(dir) = app.path().app_config_dir() {
        result.push((dir.join("config.json"), "appdata"));
    }

    result
}

pub fn choose_writable(app: &AppHandle) -> Result<(PathBuf, &'static str), String> {
    let mut last_error = String::from("没有可用的配置目录");
    for (path, location) in candidates(app) {
        let Some(parent) = path.parent() else { continue };
        if let Err(err) = fs::create_dir_all(parent) {
            last_error = format!("{}：{}", parent.display(), err);
            continue;
        }

        let probe = parent.join(format!(".write-probe-{}", std::process::id()));
        match fs::File::create(&probe) {
            Ok(mut file) => {
                let _ = file.write_all(b"ok");
                let _ = file.sync_all();
                let _ = fs::remove_file(&probe);
                return Ok((path, location));
            }
            Err(err) => last_error = format!("{}：{}", parent.display(), err),
        }
    }
    Err(last_error)
}

pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let Some(parent) = path.parent() else {
        return Err("配置路径没有父目录".into());
    };
    fs::create_dir_all(parent).map_err(|err| err.to_string())?;

    let tmp = parent.join(format!(".config-{}.tmp", std::process::id()));
    {
        let mut file = fs::File::create(&tmp).map_err(|err| err.to_string())?;
        file.write_all(bytes).map_err(|err| err.to_string())?;
        file.sync_all().map_err(|err| err.to_string())?;
    }

    if let Err(err) = replace_file(&tmp, path) {
        let _ = fs::remove_file(&tmp);
        return Err(err);
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn replace_file(from: &Path, to: &Path) -> Result<(), String> {
    fs::rename(from, to).map_err(|err| err.to_string())
}

#[cfg(target_os = "windows")]
fn replace_file(from: &Path, to: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let from_wide: Vec<u16> = from.as_os_str().encode_wide().chain(Some(0)).collect();
    let to_wide: Vec<u16> = to.as_os_str().encode_wide().chain(Some(0)).collect();
    let ok = unsafe {
        MoveFileExW(
            from_wide.as_ptr(),
            to_wide.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if ok == 0 {
        Err(std::io::Error::last_os_error().to_string())
    } else {
        Ok(())
    }
}
