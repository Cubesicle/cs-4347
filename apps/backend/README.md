# backend

NestJS backend API built with `@nx/rspack`, Rstest unit tests, and `@nestjs/drizzle` + Drizzle ORM against SQLite (`@cs-4347/db`).

## Features

- `AppModule` registers `DrizzleModule.forRootAsync` with `createDatabase()` (`./data/library.sqlite` or `DB_PATH`), ensures schema tables exist, and closes the SQLite connection on shutdown.
- `BooksModule` exposes:
  - `GET /api/books?q=...` — case-insensitive substring search across ISBN, title, and author names returning ISBN, title, comma-separated authors, and `IN`/`OUT` status (returns `[]` for blank queries).
- `BorrowersModule` exposes:
  - `POST /api/borrowers` — creates a borrower from `{ bname, ssn, address, phone? }` with the next `card_id` (e.g. `ID001001`). Returns `400` for blank required fields and `409 Conflict` for a duplicate SSN.
  - `GET /api/borrowers?q=...` — lists borrowers ordered by `card_id`, optionally filtered by a case-insensitive substring of `card_id` or name.
  - `GET /api/borrowers/:cardId` — returns a single borrower or `404 Not Found`.

## Commands

```bash
bunx nx serve backend
bunx nx build backend
bunx nx test backend
bunx nx run backend:typecheck
```
