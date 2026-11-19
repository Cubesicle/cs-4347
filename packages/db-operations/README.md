# @cs-4347/db-operations

Shared Kysely SQLite database connection and schema DDL package used by `apps/backend` and `apps/db-import`.

## Features

- `resolveSqlitePath` / `createDatabase`: Connects to SQLite via `node:sqlite` (`createNodeSqliteDatabase`), defaulting to `./data/library.sqlite` or `DB_PATH`.
- `ensureDatabaseSchema`: Creates `borrowers`, `books`, `authors`, and `book_authors` tables with primary and foreign keys if they do not exist.

## Commands

```bash
bunx nx test db-operations
bunx nx run db-operations:typecheck
```
