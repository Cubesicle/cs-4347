import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import type { Book } from "@cs-4347/db/schema";
import { App } from "./app";

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

    it("loads and renders all books from /api/books", async () => {
        const fixture = TestBed.createComponent(App);
        fixture.detectChanges();

        const req = httpTesting.expectOne("/api/books");
        expect(req.request.method).toBe("GET");

        const mockBooks: Book[] = [
            { isbn: "9780195153445", title: "Classical Mythology" },
            { isbn: "9780002005012", title: "Clara Callan: A Novel" },
        ];
        req.flush(mockBooks);

        await fixture.whenStable();
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector("h1")?.textContent).toContain("Library Books");
        expect(compiled.querySelector(".count")?.textContent).toContain("2 books in database");

        const rows = compiled.querySelectorAll("tbody tr");
        expect(rows.length).toBe(2);
        expect(rows[0]?.textContent).toContain("9780195153445");
        expect(rows[0]?.textContent).toContain("Classical Mythology");
        expect(rows[1]?.textContent).toContain("9780002005012");
        expect(rows[1]?.textContent).toContain("Clara Callan: A Novel");
    });

    it("renders an error message when loading books fails", async () => {
        const fixture = TestBed.createComponent(App);
        fixture.detectChanges();

        const req = httpTesting.expectOne("/api/books");
        req.flush("Server error", { status: 500, statusText: "Internal Server Error" });

        await fixture.whenStable();
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('[role="alert"]')?.textContent).toContain(
            "Failed to load books from /api/books.",
        );
    });
});
