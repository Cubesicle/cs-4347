use leptos::prelude::*;
use serde::Deserialize;

#[derive(Clone, Deserialize)]
struct Book {
    isbn: String,
    title: String,
}

async fn fetch_books() -> Result<Vec<Book>, String> {
    let failed = |_| "Failed to load books from /api/books.".to_owned();
    let response = gloo_net::http::Request::get("/api/books").send().await.map_err(failed)?;
    if !response.ok() {
        return Err("Failed to load books from /api/books.".to_owned());
    }
    response.json().await.map_err(failed)
}

#[component]
fn App() -> impl IntoView {
    let books = LocalResource::new(fetch_books);

    view! {
        <main class="container">
            <header class="header">
                <h1>"Library Books"</h1>
                {move || match books.get() {
                    Some(Ok(rows)) => Some(view! { <p class="count">{rows.len()} " books in database"</p> }),
                    _ => None,
                }}
            </header>
            {move || match books.get() {
                None => view! { <p class="status">"Loading books..."</p> }.into_any(),
                Some(Err(message)) => view! { <p class="status error" role="alert">{message}</p> }.into_any(),
                Some(Ok(rows)) if rows.is_empty() => view! {
                    <p class="status">"No books found. Run the database importer to populate the books table."</p>
                }
                .into_any(),
                Some(Ok(rows)) => view! {
                    <table class="books-table">
                        <thead>
                            <tr>
                                <th scope="col">"ISBN"</th>
                                <th scope="col">"Title"</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows
                                .into_iter()
                                .map(|book| view! {
                                    <tr>
                                        <td class="isbn">{book.isbn}</td>
                                        <td>{book.title}</td>
                                    </tr>
                                })
                                .collect_view()}
                        </tbody>
                    </table>
                }
                .into_any(),
            }}
        </main>
    }
}

fn main() {
    console_error_panic_hook::set_once();
    mount_to_body(App);
}
