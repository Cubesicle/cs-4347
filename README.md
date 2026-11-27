# cs-4347

Nx monorepo built with **Bun**, **Angular**, **NestJS**, **Drizzle ORM**, and **SQLite**.

## Getting Started

Install dependencies:

```bash
bun install
```

## Database Setup

1. Normalize the raw CSV files into `./data/normalized/`:

```bash
bun run normalize
```

2. Import the normalized CSV files into SQLite (defaults to `./data/library.sqlite`, override with `DB_PATH`):

```bash
bun run db:import
```

## Development Servers

Start the NestJS API (`http://localhost:3000/api/books`):

```bash
bun run serve:backend
```

Start the Angular frontend (also starts `backend:serve` and proxies `/api` to `http://localhost:3000`):

```bash
bun run serve:frontend
```

## Build, Test, Typecheck & Lint

```bash
bun run build
bun run test
bun run typecheck
bun run lint
```

## Rust

The `rust/` Cargo workspace serves the same API and UI: `axum` and `rusqlite` for the API, `Leptos` for the UI. Run each command from the repo root, so the default `./data` paths resolve.

```bash
cargo run --manifest-path rust/Cargo.toml -p normalize      # ./data/original -> ./data/normalized
cargo run --manifest-path rust/Cargo.toml -p db-import      # ./data/normalized -> ./data/library.sqlite (DB_PATH overrides)
cargo run --manifest-path rust/Cargo.toml -p library-api    # http://localhost:3000/api (PORT overrides)
cargo test --manifest-path rust/Cargo.toml
```

The UI needs the `wasm32-unknown-unknown` target and [Trunk](https://trunkrs.dev). It serves on `http://localhost:4200` and proxies `/api` to port 3000:

```bash
rustup target add wasm32-unknown-unknown
cargo install trunk --locked
cd rust/crates/frontend && trunk serve
```
