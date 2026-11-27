use std::{
    collections::{HashMap, HashSet},
    path::Path,
    sync::LazyLock,
};

use regex::Regex;
use unicode_general_category::{GeneralCategory, get_general_category};
use unicode_normalization::UnicodeNormalization;

pub struct Paths {
    pub borrowers_in: &'static str,
    pub books_in: &'static str,
    pub borrowers_out: &'static str,
    pub books_out: &'static str,
    pub authors_out: &'static str,
    pub book_authors_out: &'static str,
}

pub const PATHS: Paths = Paths {
    borrowers_in: "./data/original/borrowers.csv",
    books_in: "./data/original/books.csv",
    borrowers_out: "./data/normalized/borrowers.csv",
    books_out: "./data/normalized/books.csv",
    authors_out: "./data/normalized/authors.csv",
    book_authors_out: "./data/normalized/book_authors.csv",
};

/// Leading titles stripped from a name that keeps a given and a family name.
const TITLES: &[&str] = &[
    "dr", "mr", "mrs", "ms", "mme", "mister", "prof", "professor", "rev", "reverend", "sir", "dame",
    "lord", "lady", "capt", "captain", "col", "colonel", "gen", "general", "maj", "major", "lt", "sgt",
    "rabbi", "fr", "father", "sister", "brother", "pope", "judge", "senator", "president", "chief",
    "sr", "master", "lama", "abbot", "venerable", "bishop",
];

/// Trailing credentials stripped from a name that keeps a given and a family name.
const CREDENTIALS: &[&str] = &[
    "md", "phd", "rn", "faan", "dds", "dmd", "dvm", "mba", "msw", "lcsw", "edd", "psyd", "jd", "cpa",
    "bsn", "msn", "frcp", "facp", "facs", "ccn", "cns", "lmft", "lpc", "rd", "ld", "mph", "np", "esq",
    "mfa", "obe", "mbe", "cbe", "kbe", "frs", "dsc", "dphil", "llb", "lld", "dd", "ncc", "cdn", "do",
    "ma", "ms", "ba", "bs", "msed", "mdiv", "ncsf", "cscs", "lac", "omd", "faap", "facog", "cm", "ph",
];

/// Tokens stripped from the end of a name while another token remains.
const TRAILING_TITLES: &[&str] = &["dr.", "rinpoche"];

/// Acronyms kept uppercase when a whole-case name is recased.
const ACRONYMS: &[&str] = &["pc"];

/// Generational suffixes kept at the end of a name.
const GENERATIONS: &[&str] = &["jr", "sr", "jnr", "snr", "ii", "iii", "iv", "v", "junior", "senior"];

/// Particles that stay lowercase when a whole-case name is recased.
const PARTICLES: &[&str] = &["van", "von", "de", "der", "den", "del", "della", "di", "da", "du", "la", "le"];

/// Pen names whose leading title belongs to the name.
const SALUTATION_PEN_NAMES: &[&str] = &["dr. seuss", "dr seuss", "miss read", "pope john paul ii"];

const HYPHEN_PARTICLES: &[&str] = &["de", "del", "la", "le", "van", "von", "di", "da", "du"];

macro_rules! regex {
    ($name:ident, $pattern:expr) => {
        static $name: LazyLock<Regex> = LazyLock::new(|| Regex::new($pattern).unwrap());
    };
}

regex!(INVISIBLE, "[\u{200B}-\u{200D}\u{FEFF}\u{00AD}]");
regex!(WHITESPACE, r"\s+");
regex!(EDGE_PUNCT, r#"^[\s"'`´,;:/-]+|[\s"'`´,;:/-]+$"#);
regex!(EDGE_CONJUNCTION, r"(?i)^(?:and|&)\s+|\s+(?:and|&)$");
regex!(MC_LOWER, r"\bMc([a-z]{2,})");
regex!(HYPHEN_LOWER, r"\b([A-Za-z]+)-([a-z]{2,})\b");
regex!(PARENTHETICAL, r"\([^)]*(?:\)|$)");
regex!(ENTRY_EDGE_PUNCT, r"^[\s,;:/-]+|[\s,;:/-]+$");
regex!(CONJUNCTION_SPLIT, r"(?i)\s+(?:&|and)\s+");

fn capitalize(word: &str) -> String {
    let mut chars = word.chars();
    chars.next().map_or_else(String::new, |first| first.to_uppercase().chain(chars.flat_map(char::to_lowercase)).collect())
}

/// Lowercased token with dots and commas removed, for lexicon lookups.
fn lexicon_key(token: &str) -> String {
    token.chars().filter(|c| !matches!(c, '.' | ',')).flat_map(char::to_lowercase).collect()
}

/// Recases one token of an all-uppercase or all-lowercase name.
fn recase_token(token: &str, is_first: bool) -> String {
    let lower = token.to_lowercase();
    if !is_first && PARTICLES.contains(&lower.as_str()) {
        return lower;
    }
    let key = lexicon_key(token);
    if ["ii", "iii", "iv"].contains(&key.as_str()) {
        return token.to_uppercase();
    }
    if ACRONYMS.contains(&key.as_str()) {
        return token.to_uppercase();
    }
    let chars: Vec<char> = lower.chars().collect();
    let mut out = String::with_capacity(lower.len());
    for (i, &ch) in chars.iter().enumerate() {
        let starts_part = i == 0
            || matches!(chars[i - 1], '-' | '.' | '/')
            || (i == 2 && chars[1] == '\'')
            || (i == 2 && chars[0] == 'm' && chars[1] == 'c' && chars.len() > 3);
        if starts_part {
            out.extend(ch.to_uppercase());
        } else {
            out.push(ch);
        }
    }
    out
}

fn fix_mixed_case_tokens(text: &str) -> String {
    let text = MC_LOWER.replace_all(text, |c: &regex::Captures| format!("Mc{}", capitalize(&c[1])));
    HYPHEN_LOWER
        .replace_all(&text, |c: &regex::Captures| {
            if HYPHEN_PARTICLES.contains(&&c[2]) {
                c[0].to_owned()
            } else {
                format!("{}-{}", &c[1], capitalize(&c[2]))
            }
        })
        .into_owned()
}

/// Normalizes one author name: strips diacritics and stray punctuation, recases whole-case
/// names, and drops leading titles and trailing credentials.
pub fn normalize_author_name(name: &str) -> String {
    let cleaned: String =
        name.nfkd().filter(|&c| get_general_category(c) != GeneralCategory::NonspacingMark).collect();
    let cleaned = INVISIBLE.replace_all(&cleaned, "");
    let cleaned = WHITESPACE.replace_all(&cleaned, " ");
    let cleaned = EDGE_PUNCT.replace_all(&cleaned, "");
    let cleaned = EDGE_CONJUNCTION.replace_all(&cleaned, "");
    let cleaned = cleaned.trim();

    if !cleaned.chars().any(char::is_alphanumeric) {
        return String::new();
    }

    // "Family, Given, rest" reads as "Given Family"; the rest is dropped.
    let inverted;
    let cleaned = match cleaned.split(',').map(str::trim).collect::<Vec<_>>().as_slice() {
        [family, given, ..] if !family.is_empty() && !given.is_empty() => {
            inverted = format!("{given} {family}");
            inverted.as_str()
        }
        _ => cleaned,
    };

    let letters = || cleaned.chars().filter(|c| c.is_alphabetic());
    let whole_case = letters().all(char::is_uppercase) || letters().all(char::is_lowercase);
    let is_nickname = |t: &&str| {
        t.len() > 2 && ['\'', '"'].iter().any(|&q| t.starts_with(q) && t.ends_with(q))
    };
    let mut tokens: Vec<String> = cleaned
        .split(' ')
        .filter(|t| !is_nickname(t))
        .enumerate()
        .map(|(i, t)| if whole_case { recase_token(t, i == 0) } else { t.to_owned() })
        .collect();

    if !SALUTATION_PEN_NAMES.contains(&cleaned.to_lowercase().as_str()) {
        let leading_titles = tokens.iter().take_while(|t| TITLES.contains(&lexicon_key(t).as_str())).count();
        if tokens.len() - leading_titles >= 2 {
            tokens.drain(..leading_titles);
        }
    }

    while tokens.len() > 1 && TRAILING_TITLES.contains(&tokens.last().unwrap().to_lowercase().as_str()) {
        tokens.pop();
    }

    let mut generations = Vec::new();
    while tokens.len() > 2 {
        let key = lexicon_key(tokens.last().unwrap());
        if GENERATIONS.contains(&key.as_str()) {
            generations.push(tokens.pop().unwrap());
        } else if CREDENTIALS.contains(&key.as_str()) {
            tokens.pop();
        } else {
            break;
        }
    }
    tokens.extend(generations.into_iter().rev());

    fix_mixed_case_tokens(tokens.join(" ").trim())
}

/// Turns `LastName, FirstName` into `FirstName LastName`.
fn parse_semicolon_part(part: &str) -> String {
    let trimmed = part.trim();
    let segments: Vec<&str> = trimmed.split(',').map(str::trim).collect();
    match segments.as_slice() {
        [last, first] if !last.is_empty() && !first.is_empty() => format!("{first} {last}"),
        _ => trimmed.to_owned(),
    }
}

/// Splits, cleans, normalizes, and deduplicates an author entry.
pub fn format_authors(author_entry: &str) -> Vec<String> {
    let cleaned = author_entry.replace('"', "");
    let cleaned = PARENTHETICAL.replace_all(&cleaned, "");
    let cleaned = ENTRY_EDGE_PUNCT.replace_all(&cleaned, "");
    let cleaned = cleaned.trim();
    if cleaned.is_empty() {
        return Vec::new();
    }

    let raw_parts: Vec<String> = if cleaned.contains(';') {
        cleaned.split(';').map(parse_semicolon_part).collect()
    } else {
        cleaned.split(',').map(str::to_owned).collect()
    };

    let mut seen = HashSet::new();
    let mut authors = Vec::new();
    for raw in &raw_parts {
        for sub in CONJUNCTION_SPLIT.split(raw) {
            let normalized = normalize_author_name(sub);
            if !normalized.is_empty() && seen.insert(normalized.clone()) {
                authors.push(normalized);
            }
        }
    }
    authors
}

type Row = HashMap<String, String>;

fn read_trimmed_csv(path: &str) -> anyhow::Result<Vec<Row>> {
    let mut reader = csv::ReaderBuilder::new().trim(csv::Trim::All).flexible(true).from_path(path)?;
    let headers = reader.headers()?.clone();
    reader
        .records()
        .map(|record| Ok(headers.iter().map(str::to_owned).zip(record?.iter().map(str::to_owned)).collect()))
        .collect()
}

fn write_csv<const N: usize>(path: &str, header: [&str; N], rows: impl IntoIterator<Item = [String; N]>) -> anyhow::Result<()> {
    if let Some(parent) = Path::new(path).parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut writer = csv::WriterBuilder::new().terminator(csv::Terminator::Any(b'\n')).from_path(path)?;
    writer.write_record(header)?;
    for row in rows {
        writer.write_record(&row)?;
    }
    writer.flush()?;
    Ok(())
}

fn field<'a>(row: &'a Row, name: &str) -> &'a str {
    row.get(name).map_or("", String::as_str)
}

pub fn map_borrower(row: &Row) -> [String; 5] {
    [
        field(row, "ID0000id").to_owned(),
        field(row, "ssn").to_owned(),
        format!("{} {}", field(row, "first_name"), field(row, "last_name")),
        [field(row, "address"), field(row, "city"), field(row, "state")].join(", "),
        field(row, "phone").to_owned(),
    ]
}

pub fn map_book(row: &Row) -> [String; 2] {
    [field(row, "ISBN13").to_owned(), field(row, "Title").to_owned()]
}

pub fn normalize_borrowers(input: &str, output: &str) -> anyhow::Result<()> {
    let rows = read_trimmed_csv(input)?;
    write_csv(output, ["card_id", "ssn", "bname", "address", "phone"], rows.iter().map(map_borrower))?;
    println!("borrowers.csv finished");
    Ok(())
}

pub fn normalize_books(input: &str, output: &str) -> anyhow::Result<()> {
    let rows = read_trimmed_csv(input)?;
    write_csv(output, ["isbn", "title"], rows.iter().map(map_book))?;
    println!("books.csv finished");
    Ok(())
}

pub fn normalize_authors_and_book_authors(input: &str, authors_out: &str, book_authors_out: &str) -> anyhow::Result<()> {
    let mut author_ids: HashMap<String, usize> = HashMap::new();
    let mut author_rows = Vec::new();
    let mut book_author_rows = Vec::new();

    for row in read_trimmed_csv(input)? {
        let isbn = field(&row, "ISBN13");
        for author in format_authors(field(&row, "Author")) {
            let next_id = author_ids.len();
            let id = *author_ids.entry(author.clone()).or_insert_with(|| {
                author_rows.push([next_id.to_string(), author]);
                next_id
            });
            book_author_rows.push([isbn.to_owned(), id.to_string()]);
        }
    }

    write_csv(authors_out, ["author_id", "name"], author_rows)?;
    println!("authors.csv finished");
    write_csv(book_authors_out, ["isbn", "author_id"], book_author_rows)?;
    println!("book_authors.csv finished");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cases(pairs: &[(&str, &str)]) {
        for (input, expected) in pairs {
            assert_eq!(normalize_author_name(input), *expected, "input {input:?}");
        }
    }

    #[test]
    fn recases_whole_case_names_only() {
        cases(&[
            ("JANE AUSTEN", "Jane Austen"),
            ("STEPHEN R. DONALDSON", "Stephen R. Donaldson"),
            ("ANNE MCCAFFREY", "Anne McCaffrey"),
            ("Malachy Mccourt", "Malachy McCourt"),
            ("Anne McCaffrey", "Anne McCaffrey"),
            ("Carlo D'Este", "Carlo D'Este"),
            ("John O'Brien", "John O'Brien"),
            ("J.K. Rowling", "J.K. Rowling"),
            ("M.S. Murdock", "M.S. Murdock"),
            ("D.R. Schanker", "D.R. Schanker"),
            ("BJ James", "BJ James"),
            ("Stephanie Schaffer-de Vries", "Stephanie Schaffer-de Vries"),
        ]);
    }

    #[test]
    fn strips_titles_and_credentials_but_keeps_pen_names_and_generations() {
        cases(&[
            ("Dr. Robert C. Atkins M.D.", "Robert C. Atkins"),
            ("Bernie S. Siegel M.D.", "Bernie S. Siegel"),
            ("James Creighton Ph.D.", "James Creighton"),
            ("Dr Joyce Brothers", "Joyce Brothers"),
            ("Mr. Al Biondi", "Al Biondi"),
            ("Simeon Margolis MD Phd", "Simeon Margolis"),
            ("Joanne M. Dochterman PhD RN FAAN", "Joanne M. Dochterman"),
            ("Dr. Pedro Jose Greer Jr.", "Pedro Jose Greer Jr."),
            ("Dr. Seuss", "Dr. Seuss"),
            ("Miss Read", "Miss Read"),
            ("Pope John Paul II", "Pope John Paul II"),
            ("Donald Senior", "Donald Senior"),
            ("Katherine V.", "Katherine V."),
            ("Hanif. Kureishi", "Hanif. Kureishi"),
            ("Mel Od", "Mel Od"),
            ("In-Soo Ra", "In-Soo Ra"),
        ]);
    }

    #[test]
    fn cleans_punctuation_whitespace_and_diacritics() {
        cases(&[
            ("  John   Sandford  ", "John Sandford"),
            ("\"Mark Twain\"", "Mark Twain"),
            ("Benjamin Von Stuckrad-", "Benjamin Von Stuckrad"),
            ("Ionicus - Joshua Armitage;", "Ionicus - Joshua Armitage"),
            ("Hubert Jr Selby", "Hubert Jr Selby"),
            ("Lydia Y Minatoya", "Lydia Y Minatoya"),
            ("Margaret St George", "Margaret St George"),
            ("Fodor's", "Fodor's"),
            ("Sidonie\u{00AD}Gabrielle Colette", "SidonieGabrielle Colette"),
            ("And Lamb", "Lamb"),
            ("A. C. Bhaktivedanta Swami Prabhupâda", "A. C. Bhaktivedanta Swami Prabhupada"),
            ("Gabriel García Márquez", "Gabriel Garcia Marquez"),
            ("", ""),
            ("   ", ""),
            ("---", ""),
            (";,: ", ""),
        ]);
    }

    #[test]
    fn splits_and_deduplicates_author_entries() {
        let check = |entry: &str, expected: &[&str]| assert_eq!(format_authors(entry), expected, "entry {entry:?}");
        check("", &[]);
        check("   ", &[]);
        check("Richard Bruce Wright", &["Richard Bruce Wright"]);
        check("Mark P. O. Morford,Robert J. Lenardon", &["Mark P. O. Morford", "Robert J. Lenardon"]);
        check("Williams, Michael; Hickman, Tracy", &["Michael Williams", "Tracy Hickman"]);
        check("Tim LaHaye; Beverly LaHaye", &["Tim LaHaye", "Beverly LaHaye"]);
        check("Margaret Weis And Tracy Hickman", &["Margaret Weis", "Tracy Hickman"]);
        check("Mary-kate & Ashley Olsen", &["Mary-Kate", "Ashley Olsen"]);
        check("Edward E. Kramer & Peter Crowther,Forrest J. A", &["Edward E. Kramer", "Peter Crowther", "Forrest J. A"]);
        check("JANOSCH,JANOSCH", &["Janosch"]);
        check("Roxana Ferllini,Cyril Wecht,Dr. Cyril Wecht", &["Roxana Ferllini", "Cyril Wecht"]);
        check("Dan Brown,Colin Stinton (Narrator)", &["Dan Brown", "Colin Stinton"]);
        check("Roseanne J. Serra (Co", &["Roseanne J. Serra"]);
    }

    #[test]
    fn pipeline_assigns_author_ids_in_first_seen_order() {
        let dir = std::env::temp_dir().join(format!("normalize-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let books_in = dir.join("books.csv");
        std::fs::write(
            &books_in,
            "ISBN10,ISBN13,Title,Author,Publisher,Pages\n\
             0195153448,9780195153446,Classical Mythology,\"Mark P. O. Morford,Robert J. Lenardon\",OUP,844\n\
             0000000001,9780000000001,Test Book,\"Dr. Cyril Wecht,Cyril Wecht\",Test,100\n",
        )
        .unwrap();
        let (authors, book_authors) = (dir.join("authors.csv"), dir.join("book_authors.csv"));
        normalize_authors_and_book_authors(
            books_in.to_str().unwrap(),
            authors.to_str().unwrap(),
            book_authors.to_str().unwrap(),
        )
        .unwrap();

        assert_eq!(
            std::fs::read_to_string(&authors).unwrap(),
            "author_id,name\n0,Mark P. O. Morford\n1,Robert J. Lenardon\n2,Cyril Wecht\n"
        );
        assert_eq!(
            std::fs::read_to_string(&book_authors).unwrap(),
            "isbn,author_id\n9780195153446,0\n9780195153446,1\n9780000000001,2\n"
        );
        std::fs::remove_dir_all(dir).unwrap();
    }
}
