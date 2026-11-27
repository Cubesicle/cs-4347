use std::collections::HashMap;

use axum::{
    Json,
    extract::{Path, Query, State},
    response::Response,
};
use chrono::NaiveDate;
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};

use crate::{ApiError, ApiResult, AppState, created};

const FINE_CENTS_PER_DAY: i64 = 25;

#[derive(Debug, Default, PartialEq, Eq, Serialize)]
pub struct RefreshFinesSummary {
    pub inserted: u32,
    pub updated: u32,
    pub unchanged: u32,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
pub struct BorrowerFineSummary {
    pub card_id: String,
    pub bname: String,
    pub total_fine: String,
    pub has_unreturned_books: bool,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
pub struct PayFinesResult {
    pub card_id: String,
    pub cleared_count: usize,
    pub total_paid: String,
}

fn to_cents(amount: f64) -> i64 {
    (amount * 100.0).round() as i64
}

fn format_cents(cents: i64) -> String {
    format!("{}.{:02}", cents / 100, cents % 100)
}

fn parse_date(value: &str) -> ApiResult<NaiveDate> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d").map_err(|err| {
        eprintln!("invalid loan date {value:?}: {err}");
        ApiError::new(axum::http::StatusCode::INTERNAL_SERVER_ERROR, "Internal server error")
    })
}

/// Calculates fines at $0.25 per late day: inserts fines for overdue loans without one,
/// updates unpaid fines whose amount changed, and never modifies paid fines.
pub fn refresh_fines(conn: &mut Connection, today: NaiveDate) -> ApiResult<RefreshFinesSummary> {
    let tx = conn.transaction()?;
    let loans: Vec<(i64, String, Option<String>)> = tx
        .prepare("SELECT loan_id, due_date, date_in FROM book_loans")?
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?
        .collect::<Result<_, _>>()?;
    let existing: HashMap<i64, (f64, bool)> = tx
        .prepare("SELECT loan_id, fine_amt, paid FROM fines")?
        .query_map([], |r| Ok((r.get(0)?, (r.get(1)?, r.get(2)?))))?
        .collect::<Result<_, _>>()?;

    let mut summary = RefreshFinesSummary::default();
    for (loan_id, due_date, date_in) in loans {
        let end = match date_in {
            Some(date_in) => parse_date(&date_in)?,
            None => today,
        };
        let late_days = (end - parse_date(&due_date)?).num_days().max(0);
        if late_days == 0 {
            continue;
        }
        let fine_cents = late_days * FINE_CENTS_PER_DAY;
        match existing.get(&loan_id) {
            None => {
                tx.execute(
                    "INSERT INTO fines (loan_id, fine_amt, paid) VALUES (?1, ?2, 0)",
                    params![loan_id, format_cents(fine_cents)],
                )?;
                summary.inserted += 1;
            }
            Some(&(amount, paid)) if !paid && to_cents(amount) != fine_cents => {
                tx.execute(
                    "UPDATE fines SET fine_amt = ?1 WHERE loan_id = ?2",
                    params![format_cents(fine_cents), loan_id],
                )?;
                summary.updated += 1;
            }
            Some(_) => summary.unchanged += 1,
        }
    }
    tx.commit()?;
    Ok(summary)
}

/// Lists fine totals per borrower with at least one counted fine. Paid fines count only when
/// `include_paid` is set. `has_unreturned_books` covers every loan, fined or not.
pub fn list_fines(conn: &Connection, include_paid: bool) -> ApiResult<Vec<BorrowerFineSummary>> {
    let mut stmt = conn.prepare(
        "SELECT b.card_id, b.bname, l.loan_id, l.date_in, f.fine_amt, f.paid
         FROM borrower b
         LEFT JOIN book_loans l ON b.card_id = l.card_id
         LEFT JOIN fines f ON l.loan_id = f.loan_id",
    )?;
    let mut rows = stmt.query([])?;

    let mut order: Vec<(BorrowerFineSummary, i64, u32)> = Vec::new();
    let mut index: HashMap<String, usize> = HashMap::new();
    while let Some(row) = rows.next()? {
        let card_id: String = row.get(0)?;
        let slot = *index.entry(card_id.clone()).or_insert_with(|| {
            order.push((
                BorrowerFineSummary {
                    card_id,
                    bname: String::new(),
                    total_fine: String::new(),
                    has_unreturned_books: false,
                },
                0,
                0,
            ));
            order.len() - 1
        });
        let (summary, total_cents, fine_count) = &mut order[slot];
        summary.bname = row.get(1)?;

        let loan_id: Option<i64> = row.get(2)?;
        let date_in: Option<String> = row.get(3)?;
        if loan_id.is_some() && date_in.is_none() {
            summary.has_unreturned_books = true;
        }

        let fine_amt: Option<f64> = row.get(4)?;
        let paid: Option<bool> = row.get(5)?;
        if let (Some(amount), Some(paid)) = (fine_amt, paid)
            && (include_paid || !paid)
        {
            *total_cents += to_cents(amount);
            *fine_count += 1;
        }
    }

    Ok(order
        .into_iter()
        .filter(|(_, _, fine_count)| *fine_count > 0)
        .map(|(summary, total_cents, _)| BorrowerFineSummary { total_fine: format_cents(total_cents), ..summary })
        .collect())
}

/// Pays every unpaid fine of a borrower in one transaction. Fails when the borrower has no
/// unpaid fine, or when any unpaid fine belongs to a book not yet returned.
pub fn pay_fines(conn: &mut Connection, card_id: &str) -> ApiResult<PayFinesResult> {
    let tx = conn.transaction()?;
    let unpaid: Vec<(f64, Option<String>)> = tx
        .prepare(
            "SELECT f.fine_amt, l.date_in FROM fines f
             JOIN book_loans l ON f.loan_id = l.loan_id
             WHERE l.card_id = ?1 AND f.paid = 0",
        )?
        .query_map([card_id], |r| Ok((r.get(0)?, r.get(1)?)))?
        .collect::<Result<_, _>>()?;

    if unpaid.is_empty() {
        return Err(ApiError::not_found("Borrower has no unpaid fines"));
    }
    if unpaid.iter().any(|(_, date_in)| date_in.is_none()) {
        return Err(ApiError::bad_request("Cannot pay fines for books that have not been returned"));
    }

    tx.execute(
        "UPDATE fines SET paid = 1
         WHERE paid = 0 AND loan_id IN (SELECT loan_id FROM book_loans WHERE card_id = ?1)",
        [card_id],
    )?;
    tx.commit()?;
    Ok(PayFinesResult {
        card_id: card_id.to_owned(),
        cleared_count: unpaid.len(),
        total_paid: format_cents(unpaid.iter().map(|(amount, _)| to_cents(*amount)).sum()),
    })
}

pub async fn refresh(State(state): State<AppState>) -> ApiResult<Response> {
    let today = chrono::Utc::now().date_naive();
    Ok(created(refresh_fines(&mut state.db(), today)?))
}

#[derive(Deserialize)]
pub struct ListQuery {
    #[serde(rename = "includePaid")]
    include_paid: Option<String>,
}

pub async fn list(State(state): State<AppState>, Query(query): Query<ListQuery>) -> ApiResult<Json<Vec<BorrowerFineSummary>>> {
    Ok(Json(list_fines(&state.db(), query.include_paid.as_deref() == Some("true"))?))
}

pub async fn pay(State(state): State<AppState>, Path(card_id): Path<String>) -> ApiResult<Response> {
    Ok(created(pay_fines(&mut state.db(), &card_id)?))
}
