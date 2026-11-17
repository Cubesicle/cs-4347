# api

NestJS backend API built with `@nx/webpack`, Jest unit tests, and Kysely SQL queries against SQLite (`@cs-4347/database` and `@cs-4347/db-schema`).

## Features

- Global `DatabaseModule` initializes a Kysely SQLite connection (`./data/library.sqlite` or `DB_PATH`), ensures schema tables exist on startup, and closes the connection on shutdown.
- `BooksModule` exposes:
  - `GET /api/books` — returns all rows from the `books` table ordered by `title`, then `isbn`.
  - `GET /api/books/:isbn` — returns a single book by ISBN or `404 Not Found`.

## Commands

```bash
bunx nx serve api
bunx nx build api
bunx nx test api
bunx nx run api:typecheck
```
