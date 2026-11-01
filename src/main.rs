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
#[serde(rename_all = "PascalCase")]
struct NormalizedBook {
    #[serde(rename = "ISBN13")]
    isbn13: String,
    title: String,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct NormalizedAuthor {
    id: usize,
    name: String,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct NormalizedBookAuthors {
    #[serde(rename = "ISBN13")]
    isbn13: String,
    author_id: usize,
}

fn main() -> Result<()> {
    let output_dir = Path::new("normalized");
    fs::create_dir_all(output_dir)?;

    let mut books_reader = Reader::from_path("books.csv")?;
    let mut books_writer = Writer::from_path(output_dir.join("books.csv"))?;

    let mut authors_writer = Writer::from_path(output_dir.join("authors.csv"))?;
    let mut author_map: HashMap<String, usize> = HashMap::new();
    let mut author_id = 1;

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

    Ok(())
}

// --------------------------
// !!! INCOMING SLOP CODE !!!
// --------------------------

pub fn parse_authors(input: &str) -> impl Iterator<Item = String> + '_ {
    let has_semicolon = input.contains(';');
    let delimiter = if has_semicolon { ';' } else { ',' };

    input.split(delimiter).filter_map(move |chunk| {
        // 1. Strip role tags like "(editor)"
        let mut clean_name = String::with_capacity(chunk.len());
        let mut in_parens = false;

        for c in chunk.chars() {
            match c {
                '(' => in_parens = true,
                ')' => in_parens = false,
                _ if !in_parens => clean_name.push(c),
                _ => {}
            }
        }

        let clean_name = clean_name.trim();
        if clean_name.is_empty() {
            return None;
        }

        // 2. Reformat "Last, First" and normalize whitespace
        let normalized_name = if has_semicolon && clean_name.contains(',') {
            let mut parts = clean_name.splitn(2, ',');
            let last = parts.next().unwrap_or("").trim();
            let first = parts.next().unwrap_or("").trim();

            let first_norm = first.split_whitespace().collect::<Vec<_>>().join(" ");
            let last_norm = last.split_whitespace().collect::<Vec<_>>().join(" ");

            format!("{} {}", first_norm, last_norm).trim().to_string()
        } else {
            // Normal format: "First Last"
            clean_name.split_whitespace().collect::<Vec<_>>().join(" ")
        };

        // 3. Apply titlecase before yielding
        Some(titlecase(&normalized_name))
    })
}
