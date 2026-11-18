import csv
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path

from nameparser import Lexicon, Parser, Policy, ReadingSource, Role

INPUT_DIR = "./data/original"
OUTPUT_DIR = "./data/normalized"


@dataclass(frozen=True)
class InputPaths:
    borrowers: str
    books: str


@dataclass(frozen=True)
class OutputPaths:
    borrowers: str
    books: str
    authors: str
    book_authors: str


@dataclass(frozen=True)
class PathsConfig:
    input: InputPaths
    output: OutputPaths


PATHS = PathsConfig(
    input=InputPaths(
        borrowers=f"{INPUT_DIR}/borrowers.csv",
        books=f"{INPUT_DIR}/books.csv",
    ),
    output=OutputPaths(
        borrowers=f"{OUTPUT_DIR}/borrowers.csv",
        books=f"{OUTPUT_DIR}/books.csv",
        authors=f"{OUTPUT_DIR}/authors.csv",
        book_authors=f"{OUTPUT_DIR}/book_authors.csv",
    ),
)

# Words in the default lexicon that appear as corporate/non-salutation tokens in book authors.
NON_SALUTATIONS = {
    "singer",
    "entrepreneur",
    "author",
    "editor",
    "st",
    "st.",
    "co",
    "co.",
    "inc",
    "inc.",
    "ltd",
    "ltd.",
    "etc",
    "etc.",
    "etal",
    "etal.",
    "me",
    "pd",
}

# Short surnames/initials in books.csv that overlap with credential acronyms.
FALSE_CREDENTIALS = {"od", "ra", "gri", "r.a.", "rinpoche"}

# Pen names/titles whose leading title is integral to the author name.
SALUTATION_PEN_NAMES = {"dr. seuss", "dr seuss", "miss read", "pope john paul ii"}

HYPHEN_PARTICLES = {"de", "del", "la", "le", "van", "von", "di", "da", "du"}


def build_parser() -> Parser:
    lexicon = Lexicon.default()
    for word in NON_SALUTATIONS:
        lexicon = lexicon.remove(word, kind="title")
    for word in FALSE_CREDENTIALS:
        lexicon = lexicon.remove(word, kind="credential")
    return Parser(lexicon=lexicon, policy=Policy(unlisted_dotted_suffixes=False))


PARSER = build_parser()


def _fix_mixed_case_tokens(text: str) -> str:
    # Repair mixed-case "Mccourt" / "Mccaffrey" -> "McCourt" / "McCaffrey".
    text = re.sub(r"\bMc([a-z]{2,})", lambda m: f"Mc{m.group(1).capitalize()}", text)

    # Capitalize lowercase hyphenated given-name parts like "Mary-kate" -> "Mary-Kate",
    # while leaving hyphenated particles like "Schaffer-de" lowercase.
    def fix_hyphen(match: re.Match[str]) -> str:
        prefix, right = match.group(1), match.group(2)
        if right in HYPHEN_PARTICLES:
            return match.group(0)
        return f"{prefix}-{right.capitalize()}"

    return re.sub(r"\b([A-Za-z]+)-([a-z]{2,})\b", fix_hyphen, text)


def normalize_author_name(name: str, parser: Parser = PARSER) -> str:
    """Normalize, strip titles/credentials, and name-case a single author name."""
    cleaned = unicodedata.normalize("NFKD", name)
    cleaned = "".join(ch for ch in cleaned if unicodedata.category(ch) != "Mn")
    cleaned = re.sub(r"[\u200B-\u200D\uFEFF\u00AD]", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = re.sub(r'^[\s"\'`´,;:/-]+|[\s"\'`´,;:/-]+$', "", cleaned)
    cleaned = re.sub(r"^(?:and|&)\s+|\s+(?:and|&)$", "", cleaned, flags=re.IGNORECASE).strip()

    if not cleaned or not any(ch.isalnum() for ch in cleaned):
        return ""

    parsed = parser.parse(cleaned).capitalized()
    title_tokens = parsed.tokens_for(Role.TITLE)
    is_vocab_title = bool(title_tokens) and all(
        tok.reading is not None and tok.reading.source == ReadingSource.VOCABULARY
        for tok in title_tokens
    )
    keep_title = (
        cleaned.lower() in SALUTATION_PEN_NAMES
        or not (parsed.given and parsed.family)
        or not is_vocab_title
    )

    stripped = parsed.replace(
        title=parsed.title if keep_title else "",
        suffix=parsed.generation,
        nickname="",
    )
    return _fix_mixed_case_tokens(str(stripped).strip())


def parse_semicolon_part(part: str) -> str:
    """Invert 'LastName, FirstName' in semicolon-separated parts into 'FirstName LastName'."""
    trimmed = part.strip()
    segments = [seg.strip() for seg in trimmed.split(",")]
    if len(segments) == 2 and segments[0] and segments[1]:
        return f"{segments[1]} {segments[0]}"
    return trimmed


def format_authors(author_entry: str, parser: Parser = PARSER) -> list[str]:
    """Split, clean, normalize, and deduplicate an author entry string."""
    if not author_entry or not author_entry.strip():
        return []

    cleaned = author_entry.replace('"', "")
    cleaned = re.sub(r"\([^)]*(?:\)|$)", "", cleaned)
    cleaned = re.sub(r"^[\s,;:/-]+|[\s,;:/-]+$", "", cleaned).strip()
    if not cleaned:
        return []

    raw_parts = (
        [parse_semicolon_part(part) for part in cleaned.split(";")]
        if ";" in cleaned
        else cleaned.split(",")
    )

    seen: set[str] = set()
    authors: list[str] = []
    for raw in raw_parts:
        for sub in re.split(r"\s+(?:&|and)\s+", raw, flags=re.IGNORECASE):
            normalized = normalize_author_name(sub, parser)
            if normalized and normalized not in seen:
                seen.add(normalized)
                authors.append(normalized)

    return authors


def map_borrower(row: dict[str, str]) -> dict[str, str]:
    return {
        "card_id": row["ID0000id"],
        "ssn": row["ssn"],
        "bname": f"{row['first_name']} {row['last_name']}",
        "address": ", ".join([row["address"], row["city"], row["state"]]),
        "phone": row["phone"],
    }


def map_book(row: dict[str, str]) -> dict[str, str]:
    return {
        "isbn": row["ISBN13"],
        "title": row["Title"],
    }


def _iter_trimmed_csv(input_path: str) -> list[dict[str, str]]:
    with Path(input_path).open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        return [
            {key.strip(): (value or "").strip() for key, value in row.items() if key is not None}
            for row in reader
        ]


def _write_csv(output_path: str, fieldnames: list[str], rows: list[dict[str, str | int]]) -> None:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def normalize_borrowers(
    input_path: str = PATHS.input.borrowers,
    output_path: str = PATHS.output.borrowers,
) -> None:
    rows: list[dict[str, str | int]] = [
        dict(map_borrower(row)) for row in _iter_trimmed_csv(input_path)
    ]
    _write_csv(output_path, ["card_id", "ssn", "bname", "address", "phone"], rows)
    print("borrowers.csv finished")


def normalize_books(
    input_path: str = PATHS.input.books,
    output_path: str = PATHS.output.books,
) -> None:
    rows: list[dict[str, str | int]] = [dict(map_book(row)) for row in _iter_trimmed_csv(input_path)]
    _write_csv(output_path, ["isbn", "title"], rows)
    print("books.csv finished")


def normalize_authors_and_book_authors(
    input_path: str = PATHS.input.books,
    authors_output_path: str = PATHS.output.authors,
    book_authors_output_path: str = PATHS.output.book_authors,
) -> None:
    author_ids: dict[str, int] = {}
    author_rows: list[dict[str, str | int]] = []
    book_author_rows: list[dict[str, str | int]] = []
    next_author_id = 0

    for row in _iter_trimmed_csv(input_path):
        isbn = row["ISBN13"]
        for author in format_authors(row["Author"]):
            author_id = author_ids.get(author)
            if author_id is None:
                author_id = next_author_id
                next_author_id += 1
                author_ids[author] = author_id
                author_rows.append({"author_id": author_id, "name": author})

            book_author_rows.append({"isbn": isbn, "author_id": author_id})

    _write_csv(authors_output_path, ["author_id", "name"], author_rows)
    print("authors.csv finished")
    _write_csv(book_authors_output_path, ["isbn", "author_id"], book_author_rows)
    print("book_authors.csv finished")


def main() -> None:
    normalize_borrowers()
    normalize_books()
    normalize_authors_and_book_authors()
    print("All Files Complete!")


if __name__ == "__main__":
    main()
