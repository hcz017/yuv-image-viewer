use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct WindowConfig {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

impl Default for WindowConfig {
    fn default() -> Self {
        Self {
            x: 100,
            y: 100,
            width: 1280,
            height: 800,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct AppConfig {
    pub last_dir: Option<String>,
    pub recent_dirs: Vec<String>,
    pub window: WindowConfig,
    pub sidebar_width: f64,
    pub sort_key: String,
    pub sort_desc: bool,
    pub color_standard: String,
    pub store_location: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            last_dir: None,
            recent_dirs: Vec::new(),
            window: WindowConfig::default(),
            sidebar_width: 260.0,
            sort_key: "name".into(),
            sort_desc: false,
            color_standard: "bt601".into(),
            store_location: "default".into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_is_serializable() {
        let cfg = AppConfig::default();
        let json = serde_json::to_string(&cfg).expect("serialize");
        let back: AppConfig = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(back.sort_key, "name");
        assert_eq!(back.color_standard, "bt601");
        assert_eq!(back.window.width, 1280);
    }

    #[test]
    fn missing_fields_fall_back_to_defaults() {
        let cfg: AppConfig = serde_json::from_str(r#"{"last_dir":"/tmp"}"#).expect("deserialize");
        assert_eq!(cfg.last_dir.as_deref(), Some("/tmp"));
        assert_eq!(cfg.window.width, 1280);
        assert!(!cfg.sort_desc);
    }
}
