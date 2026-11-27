use axum::{
    Json,
    extract::{Path, Query, State},
};
use library_db::Book;
use serde::Deserialize;

use crate::{ApiError, ApiResult, AppState};

#[derive(Deserialize)]
pub struct SearchQuery {
    q: Option<String>,
}

pub async fn list(State(state): State<AppState>, Query(query): Query<SearchQuery>) -> ApiResult<Json<Vec<Book>>> {
    if query.q.as_deref().is_some_and(|q| !q.trim().is_empty()) {
        // TODO: Case-insensitive substring search across book.isbn, book.title, and
        // authors.name. Return one row per book with isbn, title, authors (comma-separated),
        // and status ("IN" if the book has no loan with date_in IS NULL, else "OUT").
        return Err(ApiError::not_implemented("TODO: Implement BooksService.search()"));
    }
    let db = state.db();
    let mut stmt = db.prepare("SELECT isbn, title FROM book ORDER BY title, isbn")?;
    let books = stmt.query_map([], Book::from_row)?.collect::<Result<_, _>>()?;
    Ok(Json(books))
}

pub async fn get_one(State(state): State<AppState>, Path(isbn): Path<String>) -> ApiResult<Json<Book>> {
    let db = state.db();
    let mut stmt = db.prepare("SELECT isbn, title FROM book WHERE isbn = ?1")?;
    let book = stmt.query_map([&isbn], Book::from_row)?.next().transpose()?;
    book.map(Json)
        .ok_or_else(|| ApiError::not_found(format!("Book with ISBN \"{isbn}\" was not found.")))
}
