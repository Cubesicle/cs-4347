use std::path::Path;

use anyhow::{Context, bail};
use rusqlite::{Connection, params};
use serde::Deserialize;

const INPUT_DIR: &str = "./data/normalized";

#[derive(Deserialize)]
struct Borrower {
    card_id: String,
    ssn: String,
    bname: String,
    address: String,
    phone: String,
}

#[derive(Deserialize)]
struct Book {
    isbn: String,
    title: String,
}

#[derive(Deserialize)]
struct Author {
    author_id: i64,
    name: String,
}

#[derive(Deserialize)]
struct BookAuthor {
    isbn: String,
    author_id: i64,
}

fn read_csv<T: for<'de> Deserialize<'de>>(file: &str) -> anyhow::Result<Vec<T>> {
    let path = Path::new(INPUT_DIR).join(file);
    if !path.exists() {
        bail!(
            "Normalized CSV file not found at \"{}\". Run \"cargo run -p normalize\" first.",
            path.display()
        );
    }
    csv::ReaderBuilder::new()
        .trim(csv::Trim::All)
        .from_path(&path)?
        .deserialize()
        .collect::<Result<_, _>>()
        .with_context(|| format!("reading {}", path.display()))
}

/// Replaces every table's rows with the normalized CSV data in one transaction.
fn import_all(conn: &mut Connection) -> anyhow::Result<[usize; 4]> {
    let borrowers: Vec<Borrower> = read_csv("borrowers.csv")?;
    let books: Vec<Book> = read_csv("books.csv")?;
    let authors: Vec<Author> = read_csv("authors.csv")?;
    let book_authors: Vec<BookAuthor> = read_csv("book_authors.csv")?;

    let tx = conn.transaction()?;
    tx.execute_batch(
        "DELETE FROM fines; DELETE FROM book_loans; DELETE FROM book_authors;
         DELETE FROM authors; DELETE FROM book; DELETE FROM borrower;",
    )?;
    {
        let mut insert = tx.prepare("INSERT INTO borrower VALUES (?1, ?2, ?3, ?4, ?5)")?;
        for b in &borrowers {
            insert.execute(params![b.card_id, b.ssn, b.bname, b.address, b.phone])?;
        }
        let mut insert = tx.prepare("INSERT INTO book (isbn, title) VALUES (?1, ?2)")?;
        for b in &books {
            insert.execute(params![b.isbn, b.title])?;
        }
        let mut insert = tx.prepare("INSERT INTO authors (author_id, name) VALUES (?1, ?2)")?;
        for a in &authors {
            insert.execute(params![a.author_id, a.name])?;
        }
        let mut insert = tx.prepare("INSERT INTO book_authors (author_id, isbn) VALUES (?1, ?2)")?;
        for ba in &book_authors {
            insert.execute(params![ba.author_id, ba.isbn])?;
        }
    }
    tx.commit()?;
    Ok([borrowers.len(), books.len(), authors.len(), book_authors.len()])
}

fn main() -> anyhow::Result<()> {
    let mut conn = library_db::open(None)?;
    let [borrowers, books, authors, book_authors] = import_all(&mut conn)?;
    println!(
        "Import complete: {borrowers} borrowers, {books} books, {authors} authors, {book_authors} book_authors."
    );
    Ok(())
}
