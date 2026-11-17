# db-import

Standalone Bun/TypeScript application that imports normalized CSV files from `./data/normalized/` into SQLite using Kysely (`@cs-4347/database` and `@cs-4347/db-schema`).

## Configuration

- `DB_PATH`: SQLite database file path (default: `./data/library.sqlite`)

## Commands

```bash
bunx nx run db-import:import
bunx nx test db-import
bunx nx run db-import:typecheck
bunx nx build db-import
```
