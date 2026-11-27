use axum::{
    Router,
    body::Body,
    http::{Request, StatusCode},
};
use chrono::NaiveDate;
use http_body_util::BodyExt;
use library_api::fines::{
    BorrowerFineSummary, PayFinesResult, RefreshFinesSummary, list_fines, pay_fines, refresh_fines,
};
use rusqlite::Connection;
use serde_json::{Value, json};
use tower::ServiceExt;

fn memory_db() -> Connection {
    library_db::open(Some(":memory:")).unwrap()
}

async fn send(app: &Router, method: &str, uri: &str, body: Option<Value>) -> (StatusCode, Value) {
    let request = Request::builder()
        .method(method)
        .uri(uri)
        .header("content-type", "application/json")
        .body(body.map_or_else(Body::empty, |b| Body::from(b.to_string())))
        .unwrap();
    let response = app.clone().oneshot(request).await.unwrap();
    let status = response.status();
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    (status, serde_json::from_slice(&bytes).unwrap_or(Value::Null))
}

fn jane() -> Value {
    json!({
        "bname": "Jane Doe",
        "ssn": "123-45-6789",
        "address": "800 W Campbell Rd, Richardson, TX",
        "phone": "(972) 883-2111",
    })
}

#[tokio::test]
async fn lists_books_by_title_and_finds_one_by_isbn() {
    let conn = memory_db();
    conn.execute_batch(
        "INSERT INTO book VALUES ('9780195153445', 'Classical Mythology');
         INSERT INTO book VALUES ('9780002005012', 'Clara Callan: A Novel');",
    )
    .unwrap();
    let app = library_api::router(conn);

    let (status, body) = send(&app, "GET", "/api/books", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        body,
        json!([
            { "isbn": "9780002005012", "title": "Clara Callan: A Novel" },
            { "isbn": "9780195153445", "title": "Classical Mythology" },
        ])
    );

    let (status, body) = send(&app, "GET", "/api/books/9780195153445", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, json!({ "isbn": "9780195153445", "title": "Classical Mythology" }));

    let (status, body) = send(&app, "GET", "/api/books/missing-isbn", None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(
        body,
        json!({ "message": "Book with ISBN \"missing-isbn\" was not found.", "error": "Not Found", "statusCode": 404 })
    );
}

#[tokio::test]
async fn creates_borrower_with_trimmed_fields_and_next_card_id() {
    let conn = memory_db();
    conn.execute_batch(
        "INSERT INTO borrower VALUES ('ID000999', '000-00-0999', 'A', 'x', NULL);
         INSERT INTO borrower VALUES ('ID001000', '000-00-1000', 'B', 'x', NULL);
         INSERT INTO borrower VALUES ('ID000001', '000-00-0001', 'C', 'x', NULL);",
    )
    .unwrap();
    let app = library_api::router(conn);

    let (status, body) = send(
        &app,
        "POST",
        "/api/borrowers",
        Some(json!({ "bname": "  Jane Doe ", "ssn": " 123-45-6789 ", "address": " 1 Main St ", "phone": "  " })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(
        body,
        json!({ "card_id": "ID001001", "ssn": "123-45-6789", "bname": "Jane Doe", "address": "1 Main St", "phone": null })
    );

    let mut second = jane_fields();
    second.insert("ssn".into(), json!("987-65-4321"));
    let (_, body) = send(&app, "POST", "/api/borrowers", Some(Value::Object(second))).await;
    assert_eq!(body["card_id"], "ID001002");

    let (status, body) = send(&app, "GET", "/api/borrowers/%20ID001001%20", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["bname"], "Jane Doe");
}

fn jane_fields() -> serde_json::Map<String, Value> {
    jane().as_object().unwrap().clone()
}

#[tokio::test]
async fn rejects_blank_or_missing_required_borrower_fields() {
    let app = library_api::router(memory_db());
    for field in ["bname", "ssn", "address"] {
        let mut blank = jane_fields();
        blank.insert(field.into(), json!("   "));
        let (status, body) = send(&app, "POST", "/api/borrowers", Some(Value::Object(blank))).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(body["message"], format!("\"{field}\" is required and must not be blank."));

        let mut missing = jane_fields();
        missing.remove(field);
        let (status, _) = send(&app, "POST", "/api/borrowers", Some(Value::Object(missing))).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
    }
    let (_, body) = send(&app, "GET", "/api/borrowers", None).await;
    assert_eq!(body, json!([]));
}

#[tokio::test]
async fn rejects_a_second_card_for_the_same_ssn() {
    let app = library_api::router(memory_db());
    send(&app, "POST", "/api/borrowers", Some(jane())).await;

    let mut other = jane_fields();
    other.insert("bname".into(), json!("Someone Else"));
    let (status, body) = send(&app, "POST", "/api/borrowers", Some(Value::Object(other))).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert!(body["message"].as_str().unwrap().contains("ID000001"));

    let (_, body) = send(&app, "GET", "/api/borrowers", None).await;
    assert_eq!(body.as_array().unwrap().len(), 1);
}

#[tokio::test]
async fn searches_borrowers_by_card_id_or_name_with_literal_wildcards() {
    let conn = memory_db();
    conn.execute_batch(
        "INSERT INTO borrower VALUES ('ID000002', '1', 'Eric Warren', 'x', NULL);
         INSERT INTO borrower VALUES ('ID000001', '2', 'Mark Morgan', 'x', NULL);
         INSERT INTO borrower VALUES ('ID000010', '3', 'Sarah Markham', 'x', NULL);",
    )
    .unwrap();
    let app = library_api::router(conn);
    let ids = |body: Value| -> Vec<String> {
        body.as_array().unwrap().iter().map(|b| b["card_id"].as_str().unwrap().to_owned()).collect()
    };

    assert_eq!(ids(send(&app, "GET", "/api/borrowers?q=%20%20", None).await.1), ["ID000001", "ID000002", "ID000010"]);
    assert_eq!(ids(send(&app, "GET", "/api/borrowers?q=MARK", None).await.1), ["ID000001", "ID000010"]);
    assert_eq!(ids(send(&app, "GET", "/api/borrowers?q=00001", None).await.1), ["ID000001", "ID000010"]);
    assert_eq!(send(&app, "GET", "/api/borrowers?q=%25", None).await.1, json!([]));
    assert_eq!(send(&app, "GET", "/api/borrowers?q=_", None).await.1, json!([]));
}

#[tokio::test]
async fn unimplemented_endpoints_answer_501() {
    let app = library_api::router(memory_db());
    for (method, uri) in [
        ("GET", "/api/books?q=will"),
        ("POST", "/api/loans/checkout"),
        ("GET", "/api/loans?q=x"),
        ("POST", "/api/loans/checkin"),
    ] {
        let (status, _) = send(&app, method, uri, None).await;
        assert_eq!(status, StatusCode::NOT_IMPLEMENTED, "{method} {uri}");
    }
}

fn fines_db() -> Connection {
    let conn = memory_db();
    conn.execute_batch(
        "INSERT INTO book VALUES ('B1', 'One'), ('B2', 'Two'), ('B3', 'Three');
         INSERT INTO borrower VALUES ('ID000001', '1', 'Alice', 'x', NULL);
         INSERT INTO borrower VALUES ('ID000002', '2', 'Bob', 'x', NULL);
         INSERT INTO book_loans (isbn, card_id, date_out, due_date, date_in)
             VALUES ('B1', 'ID000001', '2026-11-01', '2026-11-15', '2026-11-19'),
                    ('B2', 'ID000002', '2026-11-01', '2026-11-15', NULL),
                    ('B3', 'ID000002', '2026-11-01', '2026-11-30', NULL);",
    )
    .unwrap();
    conn
}

fn day(s: &str) -> NaiveDate {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
}

#[test]
fn refresh_charges_25_cents_per_late_day_and_updates_unpaid_fines() {
    let mut conn = fines_db();

    let summary = refresh_fines(&mut conn, day("2026-11-20")).unwrap();
    assert_eq!(summary, RefreshFinesSummary { inserted: 2, updated: 0, unchanged: 0 });
    assert_eq!(
        list_fines(&conn, false).unwrap(),
        [
            BorrowerFineSummary { card_id: "ID000001".into(), bname: "Alice".into(), total_fine: "1.00".into(), has_unreturned_books: false },
            BorrowerFineSummary { card_id: "ID000002".into(), bname: "Bob".into(), total_fine: "1.25".into(), has_unreturned_books: true },
        ]
    );

    let summary = refresh_fines(&mut conn, day("2026-11-22")).unwrap();
    assert_eq!(summary, RefreshFinesSummary { inserted: 0, updated: 1, unchanged: 1 });
    assert_eq!(list_fines(&conn, false).unwrap()[1].total_fine, "1.75");
}

#[test]
fn paying_clears_returned_fines_and_never_changes_paid_ones() {
    let mut conn = fines_db();
    refresh_fines(&mut conn, day("2026-11-20")).unwrap();

    assert_eq!(
        pay_fines(&mut conn, "ID000001").unwrap(),
        PayFinesResult { card_id: "ID000001".into(), cleared_count: 1, total_paid: "1.00".into() }
    );
    assert_eq!(pay_fines(&mut conn, "ID000001").unwrap_err().status, StatusCode::NOT_FOUND);
    assert_eq!(pay_fines(&mut conn, "ID000002").unwrap_err().status, StatusCode::BAD_REQUEST);

    conn.execute("UPDATE book_loans SET date_in = '2026-11-25' WHERE loan_id = 1", []).unwrap();
    let summary = refresh_fines(&mut conn, day("2026-11-20")).unwrap();
    assert_eq!(summary, RefreshFinesSummary { inserted: 0, updated: 0, unchanged: 2 });

    let unpaid_only = list_fines(&conn, false).unwrap();
    assert_eq!(unpaid_only.len(), 1);
    assert_eq!(unpaid_only[0].card_id, "ID000002");
    assert_eq!(list_fines(&conn, true).unwrap()[0].total_fine, "1.00");
}
