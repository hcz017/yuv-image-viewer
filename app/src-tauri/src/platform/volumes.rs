use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize)]
pub struct VolumeInfo {
    pub path: String,
    pub label: String,
}

pub fn list() -> Vec<VolumeInfo> {
    let mut volumes = Vec::new();
    let mut seen = HashSet::new();

    #[cfg(target_os = "windows")]
    {
        for letter in b'A'..=b'Z' {
            let root = format!("{}:\\", letter as char);
            if std::path::Path::new(&root).exists() {
                add(&mut volumes, &mut seen, PathBuf::from(root), None);
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        add(&mut volumes, &mut seen, PathBuf::from("/"), Some("Macintosh HD".into()));
        if let Ok(entries) = fs::read_dir("/Volumes") {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let label = entry.file_name().to_string_lossy().to_string();
                    add(&mut volumes, &mut seen, path, Some(label));
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        add(&mut volumes, &mut seen, PathBuf::from("/"), Some("根目录".into()));
        let user = std::env::var("USER").unwrap_or_default();
        let mut roots = vec![
            PathBuf::from("/media").join(&user),
            PathBuf::from("/mnt"),
            PathBuf::from("/run/media").join(&user),
        ];
        roots.extend(linux_mount_points());
        for root in roots {
            if let Ok(entries) = fs::read_dir(&root) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        let label = entry.file_name().to_string_lossy().to_string();
                        add(&mut volumes, &mut seen, path, Some(label));
                    }
                }
            } else if root.is_dir() {
                let label = root.to_string_lossy().to_string();
                add(&mut volumes, &mut seen, root, Some(label));
            }
        }
    }

    volumes
}

fn add(volumes: &mut Vec<VolumeInfo>, seen: &mut HashSet<String>, path: PathBuf, label: Option<String>) {
    let key = path.to_string_lossy().to_string();
    if !seen.insert(key.clone()) {
        return;
    }
    volumes.push(VolumeInfo {
        path: key.clone(),
        label: label.unwrap_or_else(|| key.clone()),
    });
}

#[cfg(target_os = "linux")]
fn linux_mount_points() -> Vec<PathBuf> {
    const PSEUDO: [&str; 10] = [
        "proc", "sysfs", "tmpfs", "devtmpfs", "cgroup", "cgroup2", "overlay", "squashfs",
        "devpts", "mqueue",
    ];
    let mut result = Vec::new();
    let Ok(contents) = fs::read_to_string("/proc/self/mounts") else {
        return result;
    };
    for line in contents.lines() {
        let fields: Vec<&str> = line.split_whitespace().collect();
        if fields.len() < 3 {
            continue;
        }
        if PSEUDO.contains(&fields[2]) {
            continue;
        }
        let mount = fields[1].replace("\\040", " ");
        if mount == "/" || !mount.starts_with('/') {
            continue;
        }
        result.push(PathBuf::from(mount));
    }
    result
}
