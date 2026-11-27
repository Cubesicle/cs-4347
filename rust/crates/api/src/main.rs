#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let conn = library_db::open(None)?;
    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_owned());
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}")).await?;
    println!("Application is running on: http://localhost:{port}/api");
    axum::serve(listener, library_api::router(conn))
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await?;
    Ok(())
}
