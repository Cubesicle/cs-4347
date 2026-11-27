use std::path::Path;

use rusqlite::{Connection, Row};
use serde::Serialize;

pub const DEFAULT_SQLITE_PATH: &str = "./data/library.sqlite";

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS book (
    isbn TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS authors (
    author_id INTEGER PRIMARY KEY NOT NULL,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS book_authors (
    author_id INTEGER NOT NULL REFERENCES authors(author_id) ON DELETE CASCADE,
    isbn TEXT NOT NULL REFERENCES book(isbn) ON DELETE CASCADE,
    PRIMARY KEY (author_id, isbn)
);
CREATE INDEX IF NOT EXISTS idx_book_authors_isbn ON book_authors (isbn);

CREATE TABLE IF NOT EXISTS borrower (
    card_id TEXT PRIMARY KEY NOT NULL,
    ssn TEXT NOT NULL UNIQUE,
    bname TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT
);

CREATE TABLE IF NOT EXISTS book_loans (
    loan_id INTEGER PRIMARY KEY AUTOINCREMENT,
    isbn TEXT NOT NULL REFERENCES book(isbn) ON DELETE RESTRICT,
    card_id TEXT NOT NULL REFERENCES borrower(card_id) ON DELETE RESTRICT,
    date_out TEXT NOT NULL,
    due_date TEXT NOT NULL,
    date_in TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_book_loans_active_isbn
    ON book_loans (isbn)
    WHERE date_in IS NULL;
CREATE INDEX IF NOT EXISTS idx_book_loans_card_id ON book_loans (card_id);
CREATE INDEX IF NOT EXISTS idx_book_loans_isbn ON book_loans (isbn);

CREATE TABLE IF NOT EXISTS fines (
    loan_id INTEGER PRIMARY KEY NOT NULL REFERENCES book_loans(loan_id) ON DELETE CASCADE,
    fine_amt DECIMAL(10, 2) NOT NULL CHECK (fine_amt >= 0),
    paid INTEGER NOT NULL DEFAULT 0 CHECK (paid IN (0, 1))
);
";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Book {
    pub isbn: String,
    pub title: String,
}

impl Book {
    pub fn from_row(row: &Row) -> rusqlite::Result<Self> {
        Ok(Self { isbn: row.get("isbn")?, title: row.get("title")? })
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Borrower {
    pub card_id: String,
    pub ssn: String,
    pub bname: String,
    pub address: String,
    pub phone: Option<String>,
}

impl Borrower {
    pub fn from_row(row: &Row) -> rusqlite::Result<Self> {
        Ok(Self {
            card_id: row.get("card_id")?,
            ssn: row.get("ssn")?,
            bname: row.get("bname")?,
            address: row.get("address")?,
            phone: row.get("phone")?,
        })
    }
}

/// Picks the explicit path, then `DB_PATH`, then [`DEFAULT_SQLITE_PATH`].
pub fn resolve_sqlite_path(explicit: Option<&str>, env_db_path: Option<&str>) -> String {
    explicit.or(env_db_path).unwrap_or(DEFAULT_SQLITE_PATH).to_owned()
}

/// Creates the library tables and indexes if they do not already exist.
pub fn ensure_schema(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(SCHEMA)
}

/// Opens the database at `path` (or `DB_PATH`, or the default), enables foreign keys, and
/// creates the schema.
pub fn open(path: Option<&str>) -> anyhow::Result<Connection> {
    let filename = resolve_sqlite_path(path, std::env::var("DB_PATH").ok().as_deref());
    let conn = if filename == ":memory:" {
        Connection::open_in_memory()?
    } else {
        if let Some(parent) = Path::new(&filename).parent() {
            std::fs::create_dir_all(parent)?;
        }
        Connection::open(&filename)?
    };
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    ensure_schema(&conn)?;
    Ok(conn)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seed_book_and_borrowers(conn: &Connection) {
        conn.execute_batch(
            "INSERT INTO book VALUES ('9780195153445', 'Classical Mythology');
             INSERT INTO borrower VALUES ('ID000001', '111-11-1111', 'Alice', '100 First St', NULL);
             INSERT INTO borrower VALUES ('ID000002', '222-22-2222', 'Bob', '200 Second St', NULL);",
        )
        .unwrap();
    }

    #[test]
    fn resolves_path_from_explicit_then_env_then_default() {
        assert_eq!(resolve_sqlite_path(None, None), "./data/library.sqlite");
        assert_eq!(resolve_sqlite_path(Some(":memory:"), Some("./other.sqlite")), ":memory:");
        assert_eq!(resolve_sqlite_path(None, Some("./custom.sqlite")), "./custom.sqlite");
    }

    #[test]
    fn enforces_unique_borrower_ssns() {
        let conn = open(Some(":memory:")).unwrap();
        conn.execute("INSERT INTO borrower VALUES ('ID000001', '111-11-1111', 'Jane', 'x', NULL)", [])
            .unwrap();
        assert!(
            conn.execute("INSERT INTO borrower VALUES ('ID000002', '111-11-1111', 'Dup', 'y', NULL)", [])
                .is_err()
        );
    }

    #[test]
    fn allows_one_active_loan_per_book() {
        let conn = open(Some(":memory:")).unwrap();
        seed_book_and_borrowers(&conn);
        let checkout = |card: &str| {
            conn.execute(
                "INSERT INTO book_loans (isbn, card_id, date_out, due_date) VALUES ('9780195153445', ?1, '2026-11-01', '2026-11-15')",
                [card],
            )
        };
        checkout("ID000001").unwrap();
        assert!(checkout("ID000002").is_err());
        conn.execute("UPDATE book_loans SET date_in = '2026-11-05' WHERE loan_id = 1", []).unwrap();
        checkout("ID000002").unwrap();
        assert_eq!(conn.last_insert_rowid(), 2);
    }

    #[test]
    fn rejects_negative_fines_and_dangling_loans() {
        let conn = open(Some(":memory:")).unwrap();
        seed_book_and_borrowers(&conn);
        conn.execute(
            "INSERT INTO book_loans (isbn, card_id, date_out, due_date) VALUES ('9780195153445', 'ID000001', '2026-11-01', '2026-11-15')",
            [],
        )
        .unwrap();
        assert!(conn.execute("INSERT INTO fines (loan_id, fine_amt) VALUES (1, '-0.25')", []).is_err());
        assert!(conn.execute("INSERT INTO fines (loan_id, fine_amt) VALUES (99, '0.25')", []).is_err());
        conn.execute("INSERT INTO fines (loan_id, fine_amt) VALUES (1, '1.25')", []).unwrap();
        let (amt, paid): (f64, bool) =
            conn.query_row("SELECT fine_amt, paid FROM fines", [], |r| Ok((r.get(0)?, r.get(1)?))).unwrap();
        assert_eq!((amt, paid), (1.25, false));
    }
}
