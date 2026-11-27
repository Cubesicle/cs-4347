use normalize::{PATHS, normalize_authors_and_book_authors, normalize_books, normalize_borrowers};

fn main() -> anyhow::Result<()> {
    normalize_borrowers(PATHS.borrowers_in, PATHS.borrowers_out)?;
    normalize_books(PATHS.books_in, PATHS.books_out)?;
    normalize_authors_and_book_authors(PATHS.books_in, PATHS.authors_out, PATHS.book_authors_out)?;
    println!("All Files Complete!");
    Ok(())
}
