use axum::response::Response;

use crate::{ApiError, ApiResult};

/// TODO: Check out a book to a borrower, atomically in one transaction:
/// - 404 when the book (`isbn`) or borrower (`card_id`) does not exist.
/// - Fail when the book has an active loan (`date_in IS NULL`).
/// - Fail when the borrower already has 3 active loans.
/// - Fail when the borrower has any unpaid fine.
/// - Insert a `book_loans` row with `date_out` = today (`YYYY-MM-DD`),
///   `due_date` = `date_out` + 14 days, and `date_in` = NULL.
pub async fn checkout() -> ApiResult<Response> {
    Err(ApiError::not_implemented("TODO: Implement LoansService.checkout()"))
}

/// TODO: Search active loans (`date_in IS NULL`) by `book.isbn`, `borrower.card_id`, or a
/// case-insensitive substring of `borrower.bname`.
pub async fn search_active() -> ApiResult<Response> {
    Err(ApiError::not_implemented("TODO: Implement LoansService.searchActiveLoans()"))
}

/// TODO: Check in 1 to 3 active loans (`loan_ids`) atomically:
/// - Deduplicate the IDs and reject counts outside 1..=3.
/// - Every loan must exist and be checked out (`date_in IS NULL`).
/// - Set `date_in` = today (`YYYY-MM-DD`) in one transaction.
pub async fn check_in() -> ApiResult<Response> {
    Err(ApiError::not_implemented("TODO: Implement LoansService.checkIn()"))
}
