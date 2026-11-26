# backend

NestJS backend API built with `@nx/rspack`, Rstest unit tests, and `@nestjs/drizzle` + Drizzle ORM against SQLite (`@cs-4347/db`).

## Features

- `AppModule` registers `DrizzleModule.forRootAsync` with `createDatabase()` (`./data/library.sqlite` or `DB_PATH`), ensures schema tables exist, and closes the SQLite connection on shutdown.
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
