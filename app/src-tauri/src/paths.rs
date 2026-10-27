use crate::error::FsError;
use std::path::{Path, PathBuf};

pub const SUPPORTED_EXTENSIONS: [&str; 6] = ["nv12", "nv21", "i420", "yv12", "p010", "yuv"];

pub fn extension_of(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
}

pub fn is_supported_path(path: &Path) -> bool {
    extension_of(path)
        .map(|ext| SUPPORTED_EXTENSIONS.contains(&ext.as_str()))
        .unwrap_or(false)
}

pub fn require_absolute(path: &str) -> Result<PathBuf, FsError> {
    let buf = PathBuf::from(path);
    if !buf.is_absolute() {
        return Err(FsError::not_supported(&buf));
    }
    Ok(buf)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extension_matching_is_case_insensitive() {
        assert!(is_supported_path(Path::new("/tmp/frame.NV12")));
        assert!(is_supported_path(Path::new("/tmp/frame.P010")));
        assert!(!is_supported_path(Path::new("/tmp/frame.png")));
        assert!(!is_supported_path(Path::new("/tmp/frame")));
    }

    #[test]
    fn relative_paths_are_rejected() {
        assert!(require_absolute("frame.nv12").is_err());
        assert!(require_absolute("/tmp/frame.nv12").is_ok());
    }
}
