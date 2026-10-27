use std::path::Path;

pub fn parse_open_args<I: IntoIterator<Item = String>>(args: I) -> Vec<String> {
    args.into_iter()
        .filter(|arg| !arg.is_empty() && !arg.starts_with('-'))
        .filter(|arg| Path::new(arg).is_absolute())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flags_are_filtered() {
        let args = vec!["-psn_0_123".to_string(), "/tmp/a.nv12".to_string()];
        assert_eq!(parse_open_args(args), vec!["/tmp/a.nv12".to_string()]);
    }

    #[test]
    fn relative_arguments_are_ignored() {
        let args = vec!["frame.nv12".to_string(), "/tmp/frame.nv12".to_string()];
        assert_eq!(parse_open_args(args), vec!["/tmp/frame.nv12".to_string()]);
    }
}
