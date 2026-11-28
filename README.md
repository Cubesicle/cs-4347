# cs-4347

Nx monorepo built with **Bun**, **Angular**, **NestJS**, **Drizzle ORM**, and **SQLite**.

## Prerequisites

- **Bun** (`>=1.4.4`)
- **uv** and **Python** (`>=3.11`, for CSV data normalization)

## Getting Started

Install JavaScript/TypeScript dependencies:

```bash
bun install
```

_(Python dependencies for `apps/data-normalization` are installed automatically by `uv` when running `bun run normalize`.)_

Optionally copy `.env.example` to `.env` (automatically loaded by Bun and ignored by Git):

```bash
cp .env.example .env
```

- `NX_NATIVE_COMMAND_RUNNER=false` — disables Nx's native PTY runner if the Nx TUI shows missing or buggy task output under Bun.

## Database Setup

1. Normalize the raw CSV files from `./data/original/` into `./data/normalized/`:

```bash
bun run normalize
```

2. Import the normalized CSV files into SQLite (defaults to `./data/library.sqlite`, override with `DB_PATH`):

```bash
bun run db:import
```

## Development Servers

Start the NestJS API (`http://localhost:3000/api`):

```bash
bun run serve:backend
```

Available API endpoints:

- `GET /api/books?q=<query>` — search books by ISBN, title, or author
- `POST /api/borrowers` — create a new borrower (`{ bname, ssn, address, phone? }`)
- `GET /api/borrowers?q=<query>` / `GET /api/borrowers/:cardId` — list, search, or fetch borrowers
- `POST /api/loans/checkout` — check out a book (`{ isbn, card_id }`)
- `GET /api/loans?q=<query>` — search active loans by ISBN, `card_id`, or borrower name
- `POST /api/loans/checkin` — check in 1–3 loans (`{ loan_ids }`)
- `POST /api/fines/refresh` — calculate and refresh late fines (`$0.25/day`)
- `GET /api/fines?includePaid=false|true` — list borrower fine totals
- `POST /api/fines/:cardId/pay` — pay all unpaid fines for a borrower

Start the Angular frontend (`http://localhost:4200`; also starts `backend:serve` and proxies `/api` to `http://localhost:3000`):

```bash
bun run serve:frontend
```

## Build, Test, Typecheck & Lint

```bash
bun run build
bun run test
bun run typecheck
bun run lint
```
