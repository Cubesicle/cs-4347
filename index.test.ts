import { describe, expect, it } from "bun:test";
import {
    type Book,
    type Borrower,
    formatAuthors,
    mapBook,
    mapBorrower,
    normalizeAuthorName,
    PATHS,
} from "./index.ts";

describe("normalizeAuthorName", () => {
    it("title-cases all-uppercase author names", () => {
        expect(normalizeAuthorName("JANE AUSTEN")).toBe("Jane Austen");
        expect(normalizeAuthorName("STEPHEN R. DONALDSON")).toBe("Stephen R. Donaldson");
    });

    it("preserves internal casing in Celtic/Italian surnames and initials", () => {
        expect(normalizeAuthorName("Anne McCaffrey")).toBe("Anne McCaffrey");
        expect(normalizeAuthorName("Carlo D'Este")).toBe("Carlo D'Este");
        expect(normalizeAuthorName("John O'Brien")).toBe("John O'Brien");
        expect(normalizeAuthorName("J.K. Rowling")).toBe("J.K. Rowling");
        expect(normalizeAuthorName("Bernie S. Siegel M.D.")).toBe("Bernie S. Siegel M.D.");
    });

    it("collapses multiple whitespace characters and trims boundaries", () => {
        expect(normalizeAuthorName("  John   Sandford  ")).toBe("John Sandford");
    });

    it("strips outer quotes and trailing non-period punctuation", () => {
        expect(normalizeAuthorName('"Mark Twain"')).toBe("Mark Twain");
        expect(normalizeAuthorName("Benjamin Von Stuckrad-")).toBe("Benjamin Von Stuckrad");
        expect(normalizeAuthorName("Ionicus - Joshua Armitage;")).toBe("Ionicus - Joshua Armitage");
    });

    it("strips soft hyphens and invisible Unicode characters", () => {
        expect(normalizeAuthorName("Sidonie\u00adGabrielle Colette")).toBe(
            "SidonieGabrielle Colette",
        );
    });

    it("removes dangling boundary conjunctions", () => {
        expect(normalizeAuthorName("And Lamb")).toBe("Lamb");
    });

    it("normalizes accented diacritical characters into standard ASCII letters", () => {
        expect(normalizeAuthorName("A. C. Bhaktivedanta Swami Prabhupâda")).toBe(
            "A. C. Bhaktivedanta Swami Prabhupada",
        );
        expect(normalizeAuthorName("Gabriel García Márquez")).toBe("Gabriel Garcia Marquez");
    });

    it("returns an empty string for empty or non-alphanumeric input", () => {
        expect(normalizeAuthorName("")).toBe("");
        expect(normalizeAuthorName("   ")).toBe("");
        expect(normalizeAuthorName("---")).toBe("");
        expect(normalizeAuthorName(";,:")).toBe("");
    });
});

describe("formatAuthors", () => {
    it("returns empty array for empty or whitespace-only inputs", () => {
        expect(formatAuthors("")).toEqual([]);
        expect(formatAuthors("   ")).toEqual([]);
    });

    it("formats a single author name", () => {
        expect(formatAuthors("Richard Bruce Wright")).toEqual(["Richard Bruce Wright"]);
    });

    it("splits comma-separated multiple authors", () => {
        expect(formatAuthors("Mark P. O. Morford,Robert J. Lenardon")).toEqual([
            "Mark P. O. Morford",
            "Robert J. Lenardon",
        ]);
    });

    it("splits semicolon-separated authors and inverts 'LastName, FirstName'", () => {
        expect(formatAuthors("Williams, Michael; Hickman, Tracy")).toEqual([
            "Michael Williams",
            "Tracy Hickman",
        ]);
    });

    it("handles semicolon-separated authors without comma inversion when not in 'Last, First' format", () => {
        expect(formatAuthors("Tim LaHaye; Beverly LaHaye")).toEqual([
            "Tim LaHaye",
            "Beverly LaHaye",
        ]);
    });

    it("splits authors conjoined by 'and' or '&'", () => {
        expect(formatAuthors("Margaret Weis And Tracy Hickman")).toEqual([
            "Margaret Weis",
            "Tracy Hickman",
        ]);
        expect(formatAuthors("Mary-kate & Ashley Olsen")).toEqual(["Mary-Kate", "Ashley Olsen"]);
        expect(formatAuthors("Edward E. Kramer & Peter Crowther,Forrest J. A")).toEqual([
            "Edward E. Kramer",
            "Peter Crowther",
            "Forrest J. A",
        ]);
    });

    it("deduplicates identical authors within the same entry", () => {
        expect(formatAuthors("JANOSCH,JANOSCH")).toEqual(["Janosch"]);
        expect(formatAuthors("Pat Hutchins,Pat Hutchins")).toEqual(["Pat Hutchins"]);
    });

    it("strips parenthetical annotations and truncated unclosed parentheses", () => {
        expect(formatAuthors("Dan Brown,Colin Stinton (Narrator)")).toEqual([
            "Dan Brown",
            "Colin Stinton",
        ]);
        expect(formatAuthors("Neil Gaiman,Charles Vess (illustrator)")).toEqual([
            "Neil Gaiman",
            "Charles Vess",
        ]);
        expect(formatAuthors("Roseanne J. Serra (Co")).toEqual(["Roseanne J. Serra"]);
    });
});

describe("mapBorrower", () => {
    it("transforms raw Borrower row into normalized snake_case format", () => {
        const raw: Borrower = {
            ID0000id: "ID000001",
            ssn: "850-47-3740",
            first_name: "Mark",
            last_name: "Morgan",
            address: "5677 Coolidge Street",
            city: "Plano",
            state: "TX",
            phone: "(469) 904-1438",
        };

        expect(mapBorrower(raw)).toEqual({
            card_id: "ID000001",
            ssn: "850-47-3740",
            bname: "Mark Morgan",
            address: "5677 Coolidge Street, Plano, TX",
            phone: "(469) 904-1438",
        });
    });
});

describe("mapBook", () => {
    it("transforms raw Book row into normalized snake_case format using ISBN13", () => {
        const raw: Book = {
            ISBN10: "0195153448",
            ISBN13: "9780195153446",
            Title: "Classical Mythology",
            Author: "Mark P. O. Morford,Robert J. Lenardon",
            Publisher: "Oxford University Press, USA",
            Pages: 844,
        };

        expect(mapBook(raw)).toEqual({
            isbn: "9780195153446",
            title: "Classical Mythology",
        });
    });
});

describe("PATHS configuration", () => {
    it("has valid input and output file paths configured", () => {
        expect(PATHS.input.borrowers).toBe("./data-original/borrowers.csv");
        expect(PATHS.input.books).toBe("./data-original/books.csv");
        expect(PATHS.output.borrowers).toBe("./data-normalized/borrowers.csv");
        expect(PATHS.output.books).toBe("./data-normalized/books.csv");
        expect(PATHS.output.authors).toBe("./data-normalized/authors.csv");
        expect(PATHS.output.bookAuthors).toBe("./data-normalized/book_authors.csv");
    });
});
