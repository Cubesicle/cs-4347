# @cs-4347/db-schema

Shared TypeScript database schema package defining Kysely table interfaces and row types with zero runtime dependencies.

## Exports

- Table interfaces: `Database`, `BorrowersTable`, `BooksTable`, `AuthorsTable`, `BookAuthorsTable`
- Row types: `Borrower`, `Book`, `Author`, `BookAuthor`

## Commands

```bash
bunx nx run db-schema:typecheck
```
