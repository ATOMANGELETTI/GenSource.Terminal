//! Per-file unified diffs via `imara-diff` (Histogram + indent heuristic).

use std::fs;
use std::hash::Hash;
use std::path::Path;

use gix::bstr::{BStr, ByteSlice};
use gix::objs::tree::EntryKind;
use imara_diff::{Algorithm, Diff, InternedInput, TokenSource};

use crate::mdoels::{
    GitChangeStatus, GitDiffHighlight, GitDiffLine, GitDiffLineKind, GitDiffSide, GitFileDiff,
};

use super::{
    head_tree_index, mutable_index, normalize_paths, open_repo, path_to_string, workdir,
};

/// Soft cap for each side (~1.5 MiB). Larger files set `truncated` and stop there.
const MAX_DIFF_BYTES: usize = 1_572_864;
/// Skip intra-line highlighting on hunks bigger than this (per side).
const MAX_INTRA_HUNK_LINES: usize = 64;
/// Skip intra-line highlighting on very long lines.
const MAX_INTRA_LINE_CHARS: usize = 4_000;

/// Compute a unified file diff for the Source Control viewer.
pub fn file_diff(
    repo_path: impl AsRef<Path>,
    file_path: &str,
    side: GitDiffSide,
) -> Result<GitFileDiff, String> {
    let repo = open_repo(repo_path)?;
    let workdir = workdir(&repo)?;
    let rela = {
        let mut paths = normalize_paths(&workdir, &[file_path.to_string()])?;
        paths.pop().ok_or_else(|| "file path is required".to_string())?
    };
    let rela_bstr: &BStr = rela.as_bytes().as_bstr();
    let absolute_path = path_to_string(&workdir.join(gix::path::from_bstr(rela_bstr)));

    let abs = workdir.join(gix::path::from_bstr(rela_bstr));
    if abs.is_dir() {
        return Err(format!("cannot diff a directory: {rela}"));
    }

    let index = mutable_index(&repo)?;
    let head_index = head_tree_index(&repo)?;

    let (old_bytes, new_bytes, status, old_label, new_label) = match side {
        GitDiffSide::Staged => {
            let old = blob_from_index(&repo, head_index.as_ref(), rela_bstr)?;
            let new = blob_from_index(&repo, Some(&index), rela_bstr)?;
            let status = status_from_presence(old.as_ref(), new.as_ref(), GitChangeStatus::Added);
            (old, new, status, "HEAD".to_string(), "Staged".to_string())
        }
        GitDiffSide::Unstaged => {
            let old = blob_from_index(&repo, Some(&index), rela_bstr)?;
            let new = worktree_bytes(&abs)?;
            let status = if old.is_none() && new.is_some() {
                GitChangeStatus::Untracked
            } else {
                status_from_presence(old.as_ref(), new.as_ref(), GitChangeStatus::Added)
            };
            (
                old,
                new,
                status,
                "Index".to_string(),
                "Working Tree".to_string(),
            )
        }
    };

    if old_bytes.is_none() && new_bytes.is_none() {
        return Err(format!("file not found: {rela}"));
    }

    let (old_raw, old_trunc) = cap_bytes(old_bytes.unwrap_or_default());
    let (new_raw, new_trunc) = cap_bytes(new_bytes.unwrap_or_default());
    let truncated = old_trunc || new_trunc;

    if is_binary(&old_raw) || is_binary(&new_raw) {
        return Ok(GitFileDiff {
            path: rela,
            absolute_path,
            status,
            side,
            binary: true,
            truncated,
            additions: 0,
            deletions: 0,
            old_label,
            new_label,
            lines: Vec::new(),
        });
    }

    let old_text = String::from_utf8(old_raw)
        .map_err(|_| "invalid UTF-8 in old side".to_string())?;
    let new_text = String::from_utf8(new_raw)
        .map_err(|_| "invalid UTF-8 in new side".to_string())?;

    let (lines, additions, deletions) = diff_lines(&old_text, &new_text);

    Ok(GitFileDiff {
        path: rela,
        absolute_path,
        status,
        side,
        binary: false,
        truncated,
        additions,
        deletions,
        old_label,
        new_label,
        lines,
    })
}

fn status_from_presence(
    old: Option<&Vec<u8>>,
    new: Option<&Vec<u8>>,
    added: GitChangeStatus,
) -> GitChangeStatus {
    match (old, new) {
        (None, Some(_)) => added,
        (Some(_), None) => GitChangeStatus::Deleted,
        _ => GitChangeStatus::Modified,
    }
}

fn blob_from_index(
    repo: &gix::Repository,
    index: Option<&gix::index::File>,
    rela: &BStr,
) -> Result<Option<Vec<u8>>, String> {
    let Some(index) = index else {
        return Ok(None);
    };
    let Some(entry) = index_entry(index, rela) else {
        return Ok(None);
    };
    let kind = entry
        .mode
        .to_tree_entry_mode()
        .map(|m| m.kind())
        .unwrap_or(EntryKind::Blob);
    if matches!(kind, EntryKind::Tree) {
        return Err(format!(
            "cannot diff a directory: {}",
            rela.to_str().unwrap_or("<path>")
        ));
    }
    let blob = repo
        .find_blob(entry.id)
        .map_err(|err| format!("read blob {}: {err}", rela))?;
    Ok(Some(blob.data.to_vec()))
}

fn index_entry<'a>(
    index: &'a gix::index::File,
    rela: &BStr,
) -> Option<&'a gix::index::Entry> {
    index
        .entry_by_path_and_stage(rela, gix::index::entry::Stage::Unconflicted)
        .or_else(|| index.entry_by_path_and_stage(rela, gix::index::entry::Stage::Ours))
}

fn worktree_bytes(abs: &Path) -> Result<Option<Vec<u8>>, String> {
    let meta = match fs::symlink_metadata(abs) {
        Ok(meta) => meta,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(err) => return Err(format!("stat {}: {err}", abs.display())),
    };
    if meta.is_dir() {
        return Err(format!("cannot diff a directory: {}", abs.display()));
    }
    if meta.file_type().is_symlink() {
        let target = fs::read_link(abs)
            .map_err(|err| format!("read link {}: {err}", abs.display()))?;
        return Ok(Some(target.to_string_lossy().into_owned().into_bytes()));
    }
    fs::read(abs)
        .map(Some)
        .map_err(|err| format!("read {}: {err}", abs.display()))
}

fn cap_bytes(mut bytes: Vec<u8>) -> (Vec<u8>, bool) {
    if bytes.len() > MAX_DIFF_BYTES {
        bytes.truncate(MAX_DIFF_BYTES);
        (bytes, true)
    } else {
        (bytes, false)
    }
}

fn is_binary(bytes: &[u8]) -> bool {
    bytes.contains(&0) || std::str::from_utf8(bytes).is_err()
}

fn diff_lines(old_text: &str, new_text: &str) -> (Vec<GitDiffLine>, u32, u32) {
    let input = InternedInput::new(old_text, new_text);
    let mut diff = Diff::compute(Algorithm::Histogram, &input);
    diff.postprocess_lines(&input);

    let mut lines = Vec::new();
    let mut additions = 0u32;
    let mut deletions = 0u32;
    let mut old_idx = 0u32;
    let mut new_idx = 0u32;

    for hunk in diff.hunks() {
        while old_idx < hunk.before.start {
            let text = display_line(&input.interner[input.before[old_idx as usize]]);
            lines.push(GitDiffLine {
                kind: GitDiffLineKind::Equal,
                old_line: Some(old_idx + 1),
                new_line: Some(new_idx + 1),
                text,
                highlights: None,
            });
            old_idx += 1;
            new_idx += 1;
        }

        let del_count = hunk.before.end.saturating_sub(hunk.before.start) as usize;
        let ins_count = hunk.after.end.saturating_sub(hunk.after.start) as usize;
        let do_intra = !hunk.is_pure_insertion()
            && !hunk.is_pure_removal()
            && del_count > 0
            && ins_count > 0
            && del_count <= MAX_INTRA_HUNK_LINES
            && ins_count <= MAX_INTRA_HUNK_LINES;

        let mut del_highlights: Vec<Option<Vec<GitDiffHighlight>>> = vec![None; del_count];
        let mut ins_highlights: Vec<Option<Vec<GitDiffHighlight>>> = vec![None; ins_count];

        if do_intra {
            let pair_n = del_count.min(ins_count);
            for i in 0..pair_n {
                let old_raw = &input.interner[input.before[hunk.before.start as usize + i]];
                let new_raw = &input.interner[input.after[hunk.after.start as usize + i]];
                let old_disp = display_line(old_raw);
                let new_disp = display_line(new_raw);
                if old_disp.chars().count() > MAX_INTRA_LINE_CHARS
                    || new_disp.chars().count() > MAX_INTRA_LINE_CHARS
                {
                    continue;
                }
                let (dh, ih) = intra_line_highlights(&old_disp, &new_disp);
                del_highlights[i] = nonempty_highlights(dh);
                ins_highlights[i] = nonempty_highlights(ih);
            }
        }

        for i in 0..del_count {
            let token = &input.interner[input.before[hunk.before.start as usize + i]];
            lines.push(GitDiffLine {
                kind: GitDiffLineKind::Delete,
                old_line: Some(old_idx + 1),
                new_line: None,
                text: display_line(token),
                highlights: del_highlights[i].clone(),
            });
            deletions = deletions.saturating_add(1);
            old_idx += 1;
        }
        for i in 0..ins_count {
            let token = &input.interner[input.after[hunk.after.start as usize + i]];
            lines.push(GitDiffLine {
                kind: GitDiffLineKind::Insert,
                old_line: None,
                new_line: Some(new_idx + 1),
                text: display_line(token),
                highlights: ins_highlights[i].clone(),
            });
            additions = additions.saturating_add(1);
            new_idx += 1;
        }
    }

    while (old_idx as usize) < input.before.len() {
        let text = display_line(&input.interner[input.before[old_idx as usize]]);
        lines.push(GitDiffLine {
            kind: GitDiffLineKind::Equal,
            old_line: Some(old_idx + 1),
            new_line: Some(new_idx + 1),
            text,
            highlights: None,
        });
        old_idx += 1;
        new_idx += 1;
    }

    (lines, additions, deletions)
}

fn display_line(token: &str) -> String {
    token
        .strip_suffix("\r\n")
        .or_else(|| token.strip_suffix('\n'))
        .unwrap_or(token)
        .to_string()
}

fn nonempty_highlights(spans: Vec<GitDiffHighlight>) -> Option<Vec<GitDiffHighlight>> {
    if spans.is_empty() {
        None
    } else {
        Some(spans)
    }
}

/// Word-level Histogram first; fall back to char-level when a side is a single token.
fn intra_line_highlights(old: &str, new: &str) -> (Vec<GitDiffHighlight>, Vec<GitDiffHighlight>) {
    let old_words = tokenize_words(old);
    let new_words = tokenize_words(new);
    if old_words.len() <= 1 && new_words.len() <= 1 {
        return char_highlights(old, new);
    }
    let (old_h, new_h) = token_highlights(&old_words, &new_words);
    if old_h.is_empty() && new_h.is_empty() {
        char_highlights(old, new)
    } else {
        (old_h, new_h)
    }
}

struct WordToken<'a> {
    text: &'a str,
    start: u32,
    end: u32,
}

fn tokenize_words(s: &str) -> Vec<WordToken<'_>> {
    let mut out = Vec::new();
    let mut char_off = 0u32;
    let mut chars = s.char_indices().peekable();
    while let Some((byte_i, ch)) = chars.next() {
        let start = char_off;
        char_off = char_off.saturating_add(1);
        if is_word_char(ch) {
            let mut end_byte = byte_i + ch.len_utf8();
            while let Some(&(nb, nc)) = chars.peek() {
                if !is_word_char(nc) {
                    break;
                }
                chars.next();
                char_off = char_off.saturating_add(1);
                end_byte = nb + nc.len_utf8();
            }
            out.push(WordToken {
                text: &s[byte_i..end_byte],
                start,
                end: char_off,
            });
        } else {
            out.push(WordToken {
                text: &s[byte_i..byte_i + ch.len_utf8()],
                start,
                end: char_off,
            });
        }
    }
    out
}

fn is_word_char(ch: char) -> bool {
    ch.is_alphanumeric() || ch == '_'
}

fn token_highlights(
    old_words: &[WordToken<'_>],
    new_words: &[WordToken<'_>],
) -> (Vec<GitDiffHighlight>, Vec<GitDiffHighlight>) {
    let old_texts: Vec<&str> = old_words.iter().map(|w| w.text).collect();
    let new_texts: Vec<&str> = new_words.iter().map(|w| w.text).collect();
    let input = InternedInput::new(CopiedSlice(&old_texts), CopiedSlice(&new_texts));
    let diff = Diff::compute(Algorithm::Histogram, &input);

    let mut old_h = Vec::new();
    let mut new_h = Vec::new();
    for hunk in diff.hunks() {
        if !hunk.before.is_empty() {
            let start = old_words[hunk.before.start as usize].start;
            let end = old_words[hunk.before.end as usize - 1].end;
            if end > start {
                old_h.push(GitDiffHighlight { start, end });
            }
        }
        if !hunk.after.is_empty() {
            let start = new_words[hunk.after.start as usize].start;
            let end = new_words[hunk.after.end as usize - 1].end;
            if end > start {
                new_h.push(GitDiffHighlight { start, end });
            }
        }
    }
    (merge_highlights(old_h), merge_highlights(new_h))
}

struct CopiedSlice<'a, T>(&'a [T]);

impl<'a, T: Hash + Eq + Copy> TokenSource for CopiedSlice<'a, T> {
    type Token = T;
    type Tokenizer = std::iter::Copied<std::slice::Iter<'a, T>>;

    fn tokenize(&self) -> Self::Tokenizer {
        self.0.iter().copied()
    }

    fn estimate_tokens(&self) -> u32 {
        self.0.len() as u32
    }
}

fn char_highlights(old: &str, new: &str) -> (Vec<GitDiffHighlight>, Vec<GitDiffHighlight>) {
    let old_chars: Vec<char> = old.chars().collect();
    let new_chars: Vec<char> = new.chars().collect();
    if old_chars.is_empty() && new_chars.is_empty() {
        return (Vec::new(), Vec::new());
    }
    let input = InternedInput::new(CopiedSlice(&old_chars), CopiedSlice(&new_chars));
    let diff = Diff::compute(Algorithm::Histogram, &input);
    let mut old_h = Vec::new();
    let mut new_h = Vec::new();
    for hunk in diff.hunks() {
        if !hunk.before.is_empty() {
            old_h.push(GitDiffHighlight {
                start: hunk.before.start,
                end: hunk.before.end,
            });
        }
        if !hunk.after.is_empty() {
            new_h.push(GitDiffHighlight {
                start: hunk.after.start,
                end: hunk.after.end,
            });
        }
    }
    (merge_highlights(old_h), merge_highlights(new_h))
}

fn merge_highlights(spans: Vec<GitDiffHighlight>) -> Vec<GitDiffHighlight> {
    let mut out: Vec<GitDiffHighlight> = Vec::new();
    for span in spans {
        if span.end <= span.start {
            continue;
        }
        if let Some(last) = out.last_mut() {
            if span.start <= last.end {
                last.end = last.end.max(span.end);
                continue;
            }
        }
        out.push(span);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::{commit, init_repo, stage};
    use std::path::PathBuf;

    fn temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "gensource-git-diff-test-{}-{}",
            std::process::id(),
            uuid_lite()
        ));
        fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    fn uuid_lite() -> u64 {
        use std::time::{SystemTime, UNIX_EPOCH};
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos() as u64)
            .unwrap_or(0)
    }

    fn write_identity(git_dir: &Path) {
        let config = git_dir.join("config");
        let mut existing = fs::read_to_string(&config).unwrap_or_default();
        if !existing.contains("[user]") {
            existing.push_str(
                "\n[user]\n\tname = GenSource Test\n\temail = test@gensource.local\n",
            );
            fs::write(&config, existing).expect("write config");
        }
    }

    fn kinds(diff: &GitFileDiff) -> Vec<GitDiffLineKind> {
        diff.lines.iter().map(|l| l.kind).collect()
    }

    #[test]
    fn untracked_is_empty_versus_file() {
        let dir = temp_dir();
        init_repo(&dir).unwrap();
        fs::write(dir.join("new.txt"), b"alpha\nbeta\n").unwrap();

        let diff = file_diff(&dir, "new.txt", GitDiffSide::Unstaged).expect("untracked diff");
        assert_eq!(diff.path, "new.txt");
        assert_eq!(diff.status, GitChangeStatus::Untracked);
        assert_eq!(diff.side, GitDiffSide::Unstaged);
        assert!(!diff.binary);
        assert!(!diff.truncated);
        assert_eq!(diff.additions, 2);
        assert_eq!(diff.deletions, 0);
        assert_eq!(diff.old_label, "Index");
        assert_eq!(diff.new_label, "Working Tree");
        assert!(kinds(&diff).iter().all(|k| *k == GitDiffLineKind::Insert));
        assert_eq!(diff.lines[0].text, "alpha");
        assert_eq!(diff.lines[0].new_line, Some(1));
        assert!(diff.lines[0].old_line.is_none());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn added_staged_is_empty_versus_index() {
        let dir = temp_dir();
        init_repo(&dir).unwrap();
        fs::write(dir.join("added.rs"), b"fn main() {}\n").unwrap();
        stage(&dir, &["added.rs".into()]).unwrap();

        let diff = file_diff(&dir, "added.rs", GitDiffSide::Staged).expect("staged add");
        assert_eq!(diff.status, GitChangeStatus::Added);
        assert_eq!(diff.side, GitDiffSide::Staged);
        assert_eq!(diff.old_label, "HEAD");
        assert_eq!(diff.new_label, "Staged");
        assert_eq!(diff.additions, 1);
        assert_eq!(diff.deletions, 0);
        assert!(kinds(&diff).iter().all(|k| *k == GitDiffLineKind::Insert));
        assert_eq!(diff.lines[0].text, "fn main() {}");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn modified_unstaged_has_equal_and_change_lines() {
        let dir = temp_dir();
        let init = init_repo(&dir).unwrap();
        write_identity(Path::new(&init.root).join(".git").as_path());

        fs::write(dir.join("app.txt"), b"keep\nhello world\nkeep2\n").unwrap();
        stage(&dir, &["app.txt".into()]).unwrap();
        commit(&dir, "add app").unwrap();

        fs::write(dir.join("app.txt"), b"keep\nhello rust\nkeep2\n").unwrap();
        let diff = file_diff(&dir, "app.txt", GitDiffSide::Unstaged).expect("modified");
        assert_eq!(diff.status, GitChangeStatus::Modified);
        assert_eq!(diff.side, GitDiffSide::Unstaged);
        assert!(diff.additions >= 1);
        assert!(diff.deletions >= 1);
        assert!(kinds(&diff).contains(&GitDiffLineKind::Equal));
        assert!(kinds(&diff).contains(&GitDiffLineKind::Delete));
        assert!(kinds(&diff).contains(&GitDiffLineKind::Insert));

        let deleted = diff
            .lines
            .iter()
            .find(|l| l.kind == GitDiffLineKind::Delete)
            .expect("delete line");
        let inserted = diff
            .lines
            .iter()
            .find(|l| l.kind == GitDiffLineKind::Insert)
            .expect("insert line");
        assert_eq!(deleted.text, "hello world");
        assert_eq!(inserted.text, "hello rust");
        assert!(
            deleted.highlights.as_ref().is_some_and(|h| !h.is_empty())
                || inserted.highlights.as_ref().is_some_and(|h| !h.is_empty()),
            "expected intra-line highlights on the word change"
        );

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn deleted_unstaged_is_blob_versus_empty() {
        let dir = temp_dir();
        let init = init_repo(&dir).unwrap();
        write_identity(Path::new(&init.root).join(".git").as_path());

        fs::write(dir.join("gone.txt"), b"one\ntwo\n").unwrap();
        stage(&dir, &["gone.txt".into()]).unwrap();
        commit(&dir, "add gone").unwrap();
        fs::remove_file(dir.join("gone.txt")).unwrap();

        let diff = file_diff(&dir, "gone.txt", GitDiffSide::Unstaged).expect("deleted");
        assert_eq!(diff.status, GitChangeStatus::Deleted);
        assert_eq!(diff.additions, 0);
        assert_eq!(diff.deletions, 2);
        assert!(kinds(&diff).iter().all(|k| *k == GitDiffLineKind::Delete));
        assert_eq!(diff.lines[0].text, "one");
        assert_eq!(diff.lines[0].old_line, Some(1));
        assert!(diff.lines[0].new_line.is_none());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn directory_is_rejected() {
        let dir = temp_dir();
        init_repo(&dir).unwrap();
        fs::create_dir_all(dir.join("subdir")).unwrap();
        let err = file_diff(&dir, "subdir", GitDiffSide::Unstaged).unwrap_err();
        assert!(
            err.contains("directory"),
            "expected directory error, got {err}"
        );
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn missing_file_is_rejected() {
        let dir = temp_dir();
        init_repo(&dir).unwrap();
        let err = file_diff(&dir, "nope.txt", GitDiffSide::Unstaged).unwrap_err();
        assert!(
            err.contains("file not found"),
            "expected missing-file error, got {err}"
        );
        let _ = fs::remove_dir_all(&dir);
    }
}
