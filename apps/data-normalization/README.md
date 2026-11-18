# data-normalization

Python application (managed with `uv`) that parses and normalizes raw CSV files from `./data/original/` into `./data/normalized/`, using `nameparser` for author name parsing, salutation/credential stripping, and capitalization.

## Prerequisites

Install Python dependencies once with `uv`:

```bash
uv sync --project apps/data-normalization
```

## Outputs

- `./data/normalized/borrowers.csv`
- `./data/normalized/books.csv`
- `./data/normalized/authors.csv`
- `./data/normalized/book_authors.csv`

## Commands

```bash
bunx nx run data-normalization:normalize
bunx nx test data-normalization
bunx nx run data-normalization:typecheck
bunx nx build data-normalization
```
