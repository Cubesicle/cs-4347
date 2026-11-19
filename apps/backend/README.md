# backend

NestJS backend API built with `@nx/rspack`, Rstest unit tests, and Kysely SQL queries against SQLite (`@cs-4347/db-operations` and `@cs-4347/db-schema`).

## Features

- Global `DatabaseModule` initializes a Kysely SQLite connection (`./data/library.sqlite` or `DB_PATH`), ensures schema tables exist on startup, and closes the connection on shutdown.
- `BooksModule` exposes:
  - `GET /api/books` — returns all rows from the `books` table ordered by `title`, then `isbn`.
  - `GET /api/books/:isbn` — returns a single book by ISBN or `404 Not Found`.

## Commands

```bash
bunx nx serve backend
bunx nx build backend
bunx nx test backend
bunx nx run backend:typecheck
```
