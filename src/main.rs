use anyhow::Result;
use csv::{Reader, Writer};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs, path::Path};
use titlecase::Titlecase;

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
        let authors = record.author.trim().to_lowercase();
        let authors = authors.split(',');
        for author in authors {
            let author = author.trim().to_string();

            if !author_map.contains_key(&author) {
                // Normalize authors
                author_map.insert(author.clone(), author_id);
                authors_writer.serialize(NormalizedAuthor {
                    id: author_id,
                    name: author.titlecase(),
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
