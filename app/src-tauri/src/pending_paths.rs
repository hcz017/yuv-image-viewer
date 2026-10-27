use std::sync::Mutex;

#[derive(Default)]
pub struct PendingPaths {
    batches: Mutex<Vec<Vec<String>>>,
}

impl PendingPaths {
    pub fn push(&self, batch: Vec<String>) {
        if batch.is_empty() {
            return;
        }
        if let Ok(mut guard) = self.batches.lock() {
            guard.push(batch);
        }
    }

    pub fn take_all(&self) -> Vec<Vec<String>> {
        self.batches
            .lock()
            .map(|mut guard| std::mem::take(&mut *guard))
            .unwrap_or_default()
    }

    #[cfg(test)]
    pub fn is_empty(&self) -> bool {
        self.batches
            .lock()
            .map(|guard| guard.is_empty())
            .unwrap_or(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn batches_are_drained_in_order() {
        let queue = PendingPaths::default();
        queue.push(vec!["/a".into()]);
        queue.push(vec!["/b".into(), "/c".into()]);
        assert!(!queue.is_empty());
        assert_eq!(
            queue.take_all(),
            vec![vec!["/a".to_string()], vec!["/b".to_string(), "/c".to_string()]]
        );
        assert!(queue.is_empty());
    }

    #[test]
    fn empty_batch_is_ignored() {
        let queue = PendingPaths::default();
        queue.push(Vec::new());
        assert!(queue.is_empty());
    }
}
