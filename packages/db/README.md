# @cs-4347/db

Shared Drizzle SQLite database package providing schema definitions, row types, and connection/DDL helpers.

## Tables

- `book` (`books`) — `isbn` (PK), `title`
- `authors` (`authors`) — `author_id` (PK), `name`
- `book_authors` (`bookAuthors`) — `author_id` (PK, FK → `authors`), `isbn` (PK, FK → `book`)
- `borrower` (`borrowers`) — `card_id` (PK), `ssn` (UNIQUE, NOT NULL), `bname` (NOT NULL), `address` (NOT NULL), `phone` (nullable)
- `book_loans` (`bookLoans`) — `loan_id` (PK, auto-increment), `isbn` (FK → `book`), `card_id` (FK → `borrower`), `date_out`, `due_date`, `date_in` (nullable; partial unique index prevents concurrent active loans on the same ISBN)
- `fines` (`fines`) — `loan_id` (PK, FK → `book_loans`), `fine_amt` (`DECIMAL(10, 2)` >= 0), `paid` (boolean `0`/`1`, default `false`)

## Entry Points

- `@cs-4347/db` — SQLite connection helpers (`resolveSqlitePath`, `createDatabase`, `ensureDatabaseSchema`, `AppDatabase`) plus all schema exports, used by `apps/backend` and `apps/db-import`.
- `@cs-4347/db/schema` — Browser-safe Drizzle SQLite table definitions and inferred row types (`Book`, `Author`, `BookAuthor`, `Borrower`, `NewBorrower`, `BookLoan`, `NewBookLoan`, `Fine`, `NewFine`), also used by `apps/frontend`.

## Commands

```bash
bunx nx test db
bunx nx run db:typecheck
```
