use serde::Serialize;
use std::io;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum FsErrorKind {
    NotFound,
    Denied,
    NotSupported,
    Io,
}

#[derive(Debug, Clone, Serialize)]
pub struct FsError {
    pub kind: FsErrorKind,
    pub message: String,
}

impl FsError {
    pub fn new(kind: FsErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
        }
    }

    pub fn not_supported(path: &Path) -> Self {
        Self::new(
            FsErrorKind::NotSupported,
            format!("不支持的路径或文件类型：{}", path.display()),
        )
    }

    pub fn from_io(err: io::Error, path: &Path) -> Self {
        let kind = match err.kind() {
            io::ErrorKind::NotFound => FsErrorKind::NotFound,
            io::ErrorKind::PermissionDenied => FsErrorKind::Denied,
            _ => FsErrorKind::Io,
        };
        Self::new(kind, format!("{}：{}", path.display(), err))
    }
}

impl From<io::Error> for FsError {
    fn from(err: io::Error) -> Self {
        Self::new(FsErrorKind::Io, err.to_string())
    }
}
