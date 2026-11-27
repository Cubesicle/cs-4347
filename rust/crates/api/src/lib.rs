pub mod books;
pub mod borrowers;
pub mod fines;
pub mod loans;

use std::sync::{Arc, Mutex, MutexGuard};

use axum::{
    Json, Router,
    http::{Method, StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use rusqlite::Connection;
use serde_json::json;

#[derive(Clone)]
pub struct AppState {
    db: Arc<Mutex<Connection>>,
}

impl AppState {
    pub fn new(conn: Connection) -> Self {
        Self { db: Arc::new(Mutex::new(conn)) }
    }

    pub fn db(&self) -> MutexGuard<'_, Connection> {
        self.db.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

/// An HTTP error with the `{ statusCode, message, error }` body NestJS sends.
#[derive(Debug)]
pub struct ApiError {
    pub status: StatusCode,
    pub message: String,
}

impl ApiError {
    pub fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self { status, message: message.into() }
    }
    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, message)
    }
    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(StatusCode::NOT_FOUND, message)
    }
    pub fn conflict(message: impl Into<String>) -> Self {
        Self::new(StatusCode::CONFLICT, message)
    }
    pub fn not_implemented(message: impl Into<String>) -> Self {
        Self::new(StatusCode::NOT_IMPLEMENTED, message)
    }
}

impl From<rusqlite::Error> for ApiError {
    fn from(err: rusqlite::Error) -> Self {
        eprintln!("database error: {err}");
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let body = if self.status == StatusCode::INTERNAL_SERVER_ERROR {
            json!({ "statusCode": 500, "message": self.message })
        } else {
            json!({
                "message": self.message,
                "error": self.status.canonical_reason().unwrap_or_default(),
                "statusCode": self.status.as_u16(),
            })
        };
        (self.status, Json(body)).into_response()
    }
}

pub type ApiResult<T> = Result<T, ApiError>;

/// NestJS answers every POST with 201 Created.
pub fn created<T: serde::Serialize>(value: T) -> Response {
    (StatusCode::CREATED, Json(value)).into_response()
}

async fn fallback(method: Method, uri: Uri) -> ApiError {
    ApiError::not_found(format!("Cannot {method} {}", uri.path()))
}

pub fn router(conn: Connection) -> Router {
    let api = Router::new()
        .route("/books", get(books::list))
        .route("/books/{isbn}", get(books::get_one))
        .route("/borrowers", post(borrowers::create).get(borrowers::list))
        .route("/borrowers/{card_id}", get(borrowers::get_one))
        .route("/loans", get(loans::search_active))
        .route("/loans/checkout", post(loans::checkout))
        .route("/loans/checkin", post(loans::check_in))
        .route("/fines", get(fines::list))
        .route("/fines/refresh", post(fines::refresh))
        .route("/fines/{card_id}/pay", post(fines::pay));

    Router::new().nest("/api", api).fallback(fallback).with_state(AppState::new(conn))
}
