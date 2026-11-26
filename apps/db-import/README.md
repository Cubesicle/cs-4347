# db-import

Standalone Bun/TypeScript application that imports normalized CSV files from `./data/normalized/` into SQLite using Drizzle ORM (`@cs-4347/db`).

## Configuration

- `DB_PATH`: SQLite database file path (default: `./data/library.sqlite`)

## Commands

```bash
bunx nx run db-import:import
bunx nx test db-import
bunx nx run db-import:typecheck
bunx nx build db-import
```
