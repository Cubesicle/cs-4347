# @cs-4347/db

Shared Drizzle SQLite database package providing schema definitions, row types, and connection/DDL helpers.

## Entry Points

- `@cs-4347/db` — SQLite connection helpers (`resolveSqlitePath`, `createDatabase`, `ensureDatabaseSchema`, `AppDatabase`) plus all schema exports, used by `apps/backend` and `apps/db-import`.
- `@cs-4347/db/schema` — Browser-safe Drizzle SQLite table definitions (`borrowers`, `books`, `authors`, `bookAuthors`) and inferred row types (`Borrower`, `Book`, `Author`, `BookAuthor`), also used by `apps/frontend`.

## Commands

```bash
bunx nx test db
bunx nx run db:typecheck
```
