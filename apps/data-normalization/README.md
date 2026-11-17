# data-normalization

Standalone Bun/TypeScript application that parses and normalizes raw CSV files from `./data/original/` into `./data/normalized/`.

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
