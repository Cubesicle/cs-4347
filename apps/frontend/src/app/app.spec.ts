import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { App } from "./app";
import type { BookSearchResult } from "./books/books.service";

describe("App", () => {
    let httpTesting: HttpTestingController;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [App],
            providers: [provideHttpClient(), provideHttpClientTesting()],
        }).compileComponents();

        httpTesting = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpTesting.verify();
    });

    it("renders the search prompt without fetching all books on initial load", () => {
        const fixture = TestBed.createComponent(App);
        fixture.detectChanges();

        httpTesting.expectNone("/api/books");

        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector("h1")?.textContent).toContain("Library Book Search");
        expect(compiled.querySelector(".status")?.textContent).toContain(
            "Enter an ISBN, title, or author name to search",
        );
    });

    it("searches /api/books?q=... and renders ISBN, title, authors, and status", async () => {
        const fixture = TestBed.createComponent(App);
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        const input = compiled.querySelector("input") as HTMLInputElement;
        const form = compiled.querySelector("form") as HTMLFormElement;

        input.value = "  will  ";
        input.dispatchEvent(new Event("input"));
        form.dispatchEvent(new Event("submit"));
        fixture.detectChanges();

        const req = httpTesting.expectOne("/api/books?q=will");
        expect(req.request.method).toBe("GET");

        const mockBooks: BookSearchResult[] = [
            {
                isbn: "0891787631",
                title: "College Algebra",
                authors: "Mary Jones, Will McDaniels",
                status: "IN",
            },
            {
                isbn: "T619875682",
                title: "Wills and Trusts for Retirement",
                authors: "Barbara Brown, ESQ",
                status: "OUT",
            },
        ];
        req.flush(mockBooks);

        await fixture.whenStable();
        fixture.detectChanges();

        expect(compiled.querySelector(".count")?.textContent).toContain("2 results");

        const rows = compiled.querySelectorAll("tbody tr");
        expect(rows.length).toBe(2);
        expect(rows[0]?.textContent).toContain("0891787631");
        expect(rows[0]?.textContent).toContain("College Algebra");
        expect(rows[0]?.textContent).toContain("Mary Jones, Will McDaniels");
        expect(rows[0]?.textContent).toContain("IN");
        expect(rows[1]?.textContent).toContain("T619875682");
        expect(rows[1]?.textContent).toContain("OUT");
    });

    it("shows an empty-state message when no books match", async () => {
        const fixture = TestBed.createComponent(App);
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        const input = compiled.querySelector("input") as HTMLInputElement;
        const form = compiled.querySelector("form") as HTMLFormElement;

        input.value = "nonexistent";
        input.dispatchEvent(new Event("input"));
        form.dispatchEvent(new Event("submit"));

        const req = httpTesting.expectOne("/api/books?q=nonexistent");
        req.flush([]);

        await fixture.whenStable();
        fixture.detectChanges();

        expect(compiled.querySelector(".count")?.textContent).toContain("0 results");
        expect(compiled.querySelector(".status")?.textContent).toContain(
            "No books matched your search.",
        );
    });

    it("ignores blank submissions without sending a request", () => {
        const fixture = TestBed.createComponent(App);
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        const input = compiled.querySelector("input") as HTMLInputElement;
        const form = compiled.querySelector("form") as HTMLFormElement;

        input.value = "   ";
        input.dispatchEvent(new Event("input"));
        form.dispatchEvent(new Event("submit"));

        httpTesting.expectNone((req) => req.url.startsWith("/api/books"));
    });

    it("renders an error message when searching fails", async () => {
        const fixture = TestBed.createComponent(App);
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        const input = compiled.querySelector("input") as HTMLInputElement;
        const form = compiled.querySelector("form") as HTMLFormElement;

        input.value = "will";
        input.dispatchEvent(new Event("input"));
        form.dispatchEvent(new Event("submit"));

        const req = httpTesting.expectOne("/api/books?q=will");
        req.flush("Server error", { status: 500, statusText: "Internal Server Error" });

        await fixture.whenStable();
        fixture.detectChanges();

        expect(compiled.querySelector('[role="alert"]')?.textContent).toContain(
            "Failed to search books from /api/books.",
        );
    });
});
