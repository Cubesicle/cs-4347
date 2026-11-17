# cs-4347

Nx monorepo built with **Bun**, **Angular**, **NestJS**, **Kysely**, and **SQLite**.

## Getting Started

Install dependencies:

```bash
bun install
```

## Database Setup

1. Normalize the raw CSV files into `./data/normalized/`:

```bash
bun run normalize
```

2. Import the normalized CSV files into SQLite (defaults to `./data/library.sqlite`, override with `DB_PATH`):

```bash
bun run db:import
```

## Development Servers

Start the NestJS API (`http://localhost:3000/api`, `http://localhost:3000/api/books`):

```bash
bun run serve:api
```

Start the Angular frontend (also starts `api:serve` and proxies `/api` to `http://localhost:3000`):

```bash
bun run serve:web
```

## Build, Test, Typecheck & Lint

```bash
bun run build
bun run test
bun run typecheck
bun run lint
```
