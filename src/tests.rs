#[test]
fn test_valid_names_in_parentheses_vs_role_tags() {
    let raw = "Robert A. (Anson) Heinlein, Malvina (Editor) Sewell";
    let parsed: Vec<String> = crate::parse_authors(raw).collect();
    assert_eq!(parsed, vec!["Robert A. (Anson) Heinlein", "Malvina Sewell"]);
}

#[test]
fn test_truncated_tags_and_semicolon_delimiters() {
    let raw = "Sue Monk; Sue Monk Kidd Kidd,Roseanne J. Serra (Co";
    let parsed: Vec<String> = crate::parse_authors(raw).collect();
    assert_eq!(
        parsed,
        vec!["Sue Monk", "Roseanne J. Serra Sue Monk Kidd Kidd"]
    );
}

#[test]
fn test_uppercase_normalization() {
    let raw = "BRADLEY P WARSHAUER,Bradley P. Warshauer";
    let parsed: Vec<String> = crate::parse_authors(raw).collect();
    assert_eq!(parsed, vec!["Bradley P Warshauer", "Bradley P. Warshauer"]);
}
