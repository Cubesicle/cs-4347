use axum::{
    Json,
    body::Bytes,
    extract::{Path, Query, State},
    response::Response,
};
use library_db::Borrower;
use rusqlite::{OptionalExtension, params};
use serde::Deserialize;
use serde_json::Value;

use crate::{ApiError, ApiResult, AppState, created};

const CARD_ID_PREFIX: &str = "ID";

/// Creates a borrower with the next `card_id` (`ID001001` after `ID001000`).
///
/// `bname`, `ssn`, and `address` are required and must not be blank; `phone` is optional.
/// One card per SSN. The SSN check, ID generation, and insert share one transaction.
pub async fn create(State(state): State<AppState>, body: Bytes) -> ApiResult<Response> {
    let input: Value = if body.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&body).map_err(|err| ApiError::bad_request(err.to_string()))?
    };
    let bname = require_text(&input, "bname")?;
    let ssn = require_text(&input, "ssn")?;
    let address = require_text(&input, "address")?;
    let phone = optional_text(&input, "phone")?;

    let mut db = state.db();
    let tx = db.transaction()?;
    let existing: Option<String> = tx
        .query_row("SELECT card_id FROM borrower WHERE ssn = ?1", [&ssn], |r| r.get(0))
        .optional()?;
    if let Some(card_id) = existing {
        return Err(ApiError::conflict(format!(
            "A borrower with SSN \"{ssn}\" already exists (card ID \"{card_id}\"). Only one library card is allowed per SSN."
        )));
    }
    let max_id: Option<i64> = tx.query_row(
        "SELECT max(cast(substr(card_id, ?1) AS integer)) FROM borrower WHERE card_id LIKE ?2",
        params![CARD_ID_PREFIX.len() as i64 + 1, format!("{CARD_ID_PREFIX}%")],
        |r| r.get(0),
    )?;
    let borrower = Borrower {
        card_id: format!("{CARD_ID_PREFIX}{:06}", max_id.unwrap_or(0) + 1),
        ssn,
        bname,
        address,
        phone,
    };
    tx.execute(
        "INSERT INTO borrower (card_id, ssn, bname, address, phone) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![borrower.card_id, borrower.ssn, borrower.bname, borrower.address, borrower.phone],
    )?;
    tx.commit()?;
    Ok(created(borrower))
}

#[derive(Deserialize)]
pub struct SearchQuery {
    q: Option<String>,
}

/// Lists borrowers by `card_id`, optionally filtered by a case-insensitive substring of
/// `card_id` or `bname`.
pub async fn list(State(state): State<AppState>, Query(query): Query<SearchQuery>) -> ApiResult<Json<Vec<Borrower>>> {
    let db = state.db();
    let term = query.q.as_deref().map(str::trim).unwrap_or_default();
    let borrowers = if term.is_empty() {
        let mut stmt = db.prepare("SELECT * FROM borrower ORDER BY card_id")?;
        stmt.query_map([], Borrower::from_row)?.collect::<Result<_, _>>()?
    } else {
        let mut stmt = db.prepare(
            "SELECT * FROM borrower WHERE card_id LIKE ?1 ESCAPE '\\' OR bname LIKE ?1 ESCAPE '\\' ORDER BY card_id",
        )?;
        stmt.query_map([format!("%{}%", escape_like(term))], Borrower::from_row)?
            .collect::<Result<_, _>>()?
    };
    Ok(Json(borrowers))
}

pub async fn get_one(State(state): State<AppState>, Path(card_id): Path<String>) -> ApiResult<Json<Borrower>> {
    let db = state.db();
    db.query_row("SELECT * FROM borrower WHERE card_id = ?1", [card_id.trim()], Borrower::from_row)
        .optional()?
        .map(Json)
        .ok_or_else(|| ApiError::not_found(format!("Borrower with card ID \"{card_id}\" was not found.")))
}

fn require_text(input: &Value, field: &str) -> ApiResult<String> {
    match input.get(field).and_then(Value::as_str).map(str::trim) {
        Some(text) if !text.is_empty() => Ok(text.to_owned()),
        _ => Err(ApiError::bad_request(format!("\"{field}\" is required and must not be blank."))),
    }
}

fn optional_text(input: &Value, field: &str) -> ApiResult<Option<String>> {
    match input.get(field) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(text)) => Ok(Some(text.trim()).filter(|t| !t.is_empty()).map(str::to_owned)),
        Some(_) => Err(ApiError::bad_request(format!("\"{field}\" must be a string."))),
    }
}

/// Escapes LIKE wildcards so `%` and `_` in user input match literally.
fn escape_like(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    for ch in value.chars() {
        if matches!(ch, '\\' | '%' | '_') {
            escaped.push('\\');
        }
        escaped.push(ch);
    }
    escaped
}
