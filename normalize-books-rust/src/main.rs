mod tests;

use anyhow::Result;
use csv::{Reader, Writer};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs, path::Path};
use titlecase::titlecase;

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct Book {
    #[serde(rename = "ISBN10")]
    isbn10: String,
    #[serde(rename = "ISBN13")]
    isbn13: String,
    title: String,
    author: String,
    publisher: String,
    pages: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct NormalizedBook {
    isbn13: String,
    title: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct NormalizedAuthor {
    id: usize,
    name: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct NormalizedBookAuthors {
    isbn13: String,
    author_id: usize,
}

#[derive(Serialize, Deserialize, Debug)]
struct Borrower {
    #[serde(rename = "ID0000id")]
    id: String,
    ssn: String,
    first_name: String,
    last_name: String,
    email: String,
    address: String,
    city: String,
    state: String,
    phone: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct NormalizedBorrower {
    card_id: String,
    ssn: String,
    bname: String,
    address: String,
    phone: String,
}

fn main() -> Result<()> {
    let output_dir = Path::new("normalized");
    fs::create_dir_all(output_dir)?;

    let mut books_reader = Reader::from_path("books.csv")?;
    let mut books_writer = Writer::from_path(output_dir.join("books.csv"))?;

    let mut authors_writer = Writer::from_path(output_dir.join("authors.csv"))?;
    let mut author_map: HashMap<String, usize> = HashMap::new();
    let mut author_id = 0;

    let mut book_authors_writer = Writer::from_path(output_dir.join("book_authors.csv"))?;

    for result in books_reader.deserialize() {
        let record: Book = result?;

        // Normalize books.csv
        books_writer.serialize(NormalizedBook {
            isbn13: record.isbn13.clone(),
            title: record.title,
        })?;

        // Iterate through all authors and assign them an id
        let authors = parse_authors(&record.author);
        for author in authors {
            if !author_map.contains_key(&author) {
                // Normalize authors
                author_map.insert(author.clone(), author_id);
                authors_writer.serialize(NormalizedAuthor {
                    id: author_id,
                    name: author.clone(),
                })?;

                author_id += 1;
            }

            // Normalize book authors
            book_authors_writer.serialize(NormalizedBookAuthors {
                isbn13: record.isbn13.clone(),
                author_id: *author_map.get(&author).unwrap(),
            })?;
        }
    }

    let mut borrowers_reader = Reader::from_path("borrowers.csv")?;
    let mut borrowers_writer = Writer::from_path(output_dir.join("borrowers.csv"))?;
    for result in borrowers_reader.deserialize() {
        let record: Borrower = result?;
        borrowers_writer.serialize(NormalizedBorrower {
            card_id: record.id,
            ssn: record.ssn,
            bname: format!("{} {}", record.first_name, record.last_name),
            address: format!("{}, {}, {}", record.address, record.city, record.state),
            phone: record.phone,
        })?;
    }

    Ok(())
}

// --------------------------
// !!! INCOMING SLOP CODE !!!
// --------------------------

pub fn parse_authors(input: &str) -> impl Iterator<Item = String> + '_ {
    let has_semicolon = input.contains(';');
    let delimiter = if has_semicolon { ';' } else { ',' };

    input.split(delimiter).filter_map(move |chunk| {
        // 1. Smart Role Tag Stripping
        let mut clean_name = String::with_capacity(chunk.len());
        let mut chars = chunk.chars().peekable();

        while let Some(c) = chars.next() {
            if c == '(' {
                // Peek ahead to see if the parentheses hold a role or a valid name
                let remaining: String = chars.clone().collect();
                let lower = remaining.to_lowercase();

                if lower.starts_with("editor")
                    || lower.starts_with("translator")
                    || lower.starts_with("illustrator")
                    || lower.starts_with("narrator")
                    || lower.starts_with("ed.")
                    || lower.starts_with("eds.")
                    || (lower.starts_with("co") && (lower.len() <= 3 || lower.starts_with("co-")))
                {
                    // It's a role tag: fast-forward the iterator to drop it.
                    // This also naturally handles truncated tags missing the ')'
                    while let Some(inner_c) = chars.next() {
                        if inner_c == ')' {
                            break;
                        }
                    }
                    continue;
                }
            }
            clean_name.push(c);
        }

        let clean_name = clean_name.trim();
        if clean_name.is_empty() {
            return None;
        }

        // 2. Reformat "Last, First" if semicolon-delimited, and normalize whitespace
        let normalized_name = if has_semicolon && clean_name.contains(',') {
            let mut parts = clean_name.splitn(2, ',');
            let last = parts.next().unwrap_or("").trim();
            let first = parts.next().unwrap_or("").trim();

            let first_norm = first.split_whitespace().collect::<Vec<_>>().join(" ");
            let last_norm = last.split_whitespace().collect::<Vec<_>>().join(" ");

            format!("{} {}", first_norm, last_norm)
        } else {
            // Normal format: "First Last"
            clean_name.split_whitespace().collect::<Vec<_>>().join(" ")
        };

        // Remove any lingering structural commas
        let final_clean = normalized_name.replace(',', "");

        // 3. Apply titlecase crate
        Some(titlecase(final_clean.trim()))
    })
}
