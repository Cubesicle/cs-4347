import csv
from pathlib import Path

from main import (
    PATHS,
    format_authors,
    map_book,
    map_borrower,
    normalize_author_name,
    normalize_authors_and_book_authors,
    normalize_books,
    normalize_borrowers,
)


def test_normalize_author_name_casing() -> None:
    assert normalize_author_name("JANE AUSTEN") == "Jane Austen"
    assert normalize_author_name("STEPHEN R. DONALDSON") == "Stephen R. Donaldson"
    assert normalize_author_name("ANNE MCCAFFREY") == "Anne McCaffrey"
    assert normalize_author_name("Malachy Mccourt") == "Malachy McCourt"


def test_normalize_author_name_preserves_mixed_case_and_initials() -> None:
    assert normalize_author_name("Anne McCaffrey") == "Anne McCaffrey"
    assert normalize_author_name("Carlo D'Este") == "Carlo D'Este"
    assert normalize_author_name("John O'Brien") == "John O'Brien"
    assert normalize_author_name("J.K. Rowling") == "J.K. Rowling"
    assert normalize_author_name("M.S. Murdock") == "M.S. Murdock"
    assert normalize_author_name("D.R. Schanker") == "D.R. Schanker"
    assert normalize_author_name("BJ James") == "BJ James"
    assert normalize_author_name("Stephanie Schaffer-de Vries") == "Stephanie Schaffer-de Vries"


def test_normalize_author_name_salutations_and_credentials() -> None:
    assert normalize_author_name("Dr. Robert C. Atkins M.D.") == "Robert C. Atkins"
    assert normalize_author_name("Bernie S. Siegel M.D.") == "Bernie S. Siegel"
    assert normalize_author_name("James Creighton Ph.D.") == "James Creighton"
    assert normalize_author_name("Dr Joyce Brothers") == "Joyce Brothers"
    assert normalize_author_name("Mr. Al Biondi") == "Al Biondi"
    assert normalize_author_name("Simeon Margolis MD Phd") == "Simeon Margolis"
    assert normalize_author_name("Joanne M. Dochterman PhD RN FAAN") == "Joanne M. Dochterman"
    assert normalize_author_name("Dr. Pedro Jose Greer Jr.") == "Pedro Jose Greer Jr."
    assert normalize_author_name("Dr. Seuss") == "Dr. Seuss"
    assert normalize_author_name("Miss Read") == "Miss Read"
    assert normalize_author_name("Pope John Paul II") == "Pope John Paul II"
    assert normalize_author_name("Donald Senior") == "Donald Senior"
    assert normalize_author_name("Katherine V.") == "Katherine V."
    assert normalize_author_name("Hanif. Kureishi") == "Hanif. Kureishi"
    assert normalize_author_name("Mel Od") == "Mel Od"
    assert normalize_author_name("In-Soo Ra") == "In-Soo Ra"


def test_normalize_author_name_cleanup_and_diacritics() -> None:
    assert normalize_author_name("  John   Sandford  ") == "John Sandford"
    assert normalize_author_name('"Mark Twain"') == "Mark Twain"
    assert normalize_author_name("Benjamin Von Stuckrad-") == "Benjamin Von Stuckrad"
    assert normalize_author_name("Ionicus - Joshua Armitage;") == "Ionicus - Joshua Armitage"
    assert normalize_author_name("Hubert Jr Selby") == "Hubert Jr Selby"
    assert normalize_author_name("Lydia Y Minatoya") == "Lydia Y Minatoya"
    assert normalize_author_name("Margaret St George") == "Margaret St George"
    assert normalize_author_name("Fodor's") == "Fodor's"
    assert normalize_author_name("Sidonie\u00adGabrielle Colette") == "SidonieGabrielle Colette"
    assert normalize_author_name("And Lamb") == "Lamb"
    assert (
        normalize_author_name("A. C. Bhaktivedanta Swami Prabhupâda")
        == "A. C. Bhaktivedanta Swami Prabhupada"
    )
    assert normalize_author_name("Gabriel García Márquez") == "Gabriel Garcia Marquez"
    assert normalize_author_name("") == ""
    assert normalize_author_name("   ") == ""
    assert normalize_author_name("---") == ""
    assert normalize_author_name(";,: ") == ""


def test_format_authors() -> None:
    assert format_authors("") == []
    assert format_authors("   ") == []
    assert format_authors("Richard Bruce Wright") == ["Richard Bruce Wright"]
    assert format_authors("Mark P. O. Morford,Robert J. Lenardon") == [
        "Mark P. O. Morford",
        "Robert J. Lenardon",
    ]
    assert format_authors("Williams, Michael; Hickman, Tracy") == [
        "Michael Williams",
        "Tracy Hickman",
    ]
    assert format_authors("Tim LaHaye; Beverly LaHaye") == ["Tim LaHaye", "Beverly LaHaye"]
    assert format_authors("Margaret Weis And Tracy Hickman") == [
        "Margaret Weis",
        "Tracy Hickman",
    ]
    assert format_authors("Mary-kate & Ashley Olsen") == ["Mary-Kate", "Ashley Olsen"]
    assert format_authors("Edward E. Kramer & Peter Crowther,Forrest J. A") == [
        "Edward E. Kramer",
        "Peter Crowther",
        "Forrest J. A",
    ]
    assert format_authors("JANOSCH,JANOSCH") == ["Janosch"]
    assert format_authors("Pat Hutchins,Pat Hutchins") == ["Pat Hutchins"]
    assert format_authors("Roxana Ferllini,Cyril Wecht,Dr. Cyril Wecht") == [
        "Roxana Ferllini",
        "Cyril Wecht",
    ]
    assert format_authors("Dan Brown,Colin Stinton (Narrator)") == [
        "Dan Brown",
        "Colin Stinton",
    ]
    assert format_authors("Neil Gaiman,Charles Vess (illustrator)") == [
        "Neil Gaiman",
        "Charles Vess",
    ]
    assert format_authors("Roseanne J. Serra (Co") == ["Roseanne J. Serra"]


def test_mappers_and_paths() -> None:
    assert map_borrower(
        {
            "ID0000id": "ID000001",
            "ssn": "850-47-3740",
            "first_name": "Mark",
            "last_name": "Morgan",
            "address": "5677 Coolidge Street",
            "city": "Plano",
            "state": "TX",
            "phone": "(469) 904-1438",
        }
    ) == {
        "card_id": "ID000001",
        "ssn": "850-47-3740",
        "bname": "Mark Morgan",
        "address": "5677 Coolidge Street, Plano, TX",
        "phone": "(469) 904-1438",
    }

    assert map_book(
        {
            "ISBN10": "0195153448",
            "ISBN13": "9780195153446",
            "Title": "Classical Mythology",
            "Author": "Mark P. O. Morford,Robert J. Lenardon",
            "Publisher": "Oxford University Press, USA",
            "Pages": "844",
        }
    ) == {
        "isbn": "9780195153446",
        "title": "Classical Mythology",
    }

    assert PATHS.input.borrowers == "./data/original/borrowers.csv"
    assert PATHS.input.books == "./data/original/books.csv"
    assert PATHS.output.borrowers == "./data/normalized/borrowers.csv"
    assert PATHS.output.books == "./data/normalized/books.csv"
    assert PATHS.output.authors == "./data/normalized/authors.csv"
    assert PATHS.output.book_authors == "./data/normalized/book_authors.csv"


def test_end_to_end_csv_pipeline(tmp_path: Path) -> None:
    borrowers_in = tmp_path / "borrowers_in.csv"
    books_in = tmp_path / "books_in.csv"
    out_dir = tmp_path / "out"

    borrowers_in.write_text(
        "ID0000id,ssn,first_name,last_name,email,address,city,state,phone\n"
        "ID000001,850-47-3740,Mark,Morgan,mm@g.co,5677 Coolidge Street,Plano,TX,(469) 904-1438\n",
        encoding="utf-8",
    )
    books_in.write_text(
        "ISBN10,ISBN13,Title,Author,Publisher,Pages\n"
        '0195153448,9780195153446,Classical Mythology,"Mark P. O. Morford,Robert J. Lenardon",OUP,844\n'
        '0000000001,9780000000001,Test Book,"Dr. Cyril Wecht,Cyril Wecht",Test,100\n',
        encoding="utf-8",
    )

    normalize_borrowers(str(borrowers_in), str(out_dir / "borrowers.csv"))
    normalize_books(str(books_in), str(out_dir / "books.csv"))
    normalize_authors_and_book_authors(
        str(books_in),
        str(out_dir / "authors.csv"),
        str(out_dir / "book_authors.csv"),
    )

    with (out_dir / "authors.csv").open(newline="", encoding="utf-8") as f:
        authors = list(csv.DictReader(f))
    with (out_dir / "book_authors.csv").open(newline="", encoding="utf-8") as f:
        book_authors = list(csv.DictReader(f))

    assert authors == [
        {"author_id": "0", "name": "Mark P. O. Morford"},
        {"author_id": "1", "name": "Robert J. Lenardon"},
        {"author_id": "2", "name": "Cyril Wecht"},
    ]
    assert book_authors == [
        {"isbn": "9780195153446", "author_id": "0"},
        {"isbn": "9780195153446", "author_id": "1"},
        {"isbn": "9780000000001", "author_id": "2"},
    ]
