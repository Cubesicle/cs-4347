# @cs-4347/database

Shared Kysely SQLite database connection and schema DDL package used by `apps/api` and `apps/db-import`.

## Features

- `resolveSqlitePath` / `createDatabase`: Connects to SQLite via `node:sqlite` (`createNodeSqliteDatabase`), defaulting to `./data/library.sqlite` or `DB_PATH`.
- `ensureDatabaseSchema`: Creates `borrowers`, `books`, `authors`, and `book_authors` tables with primary and foreign keys if they do not exist.

## Commands

```bash
bunx nx test database
bunx nx run database:typecheck
```
