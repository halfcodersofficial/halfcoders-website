import type { CoursePhase } from "@/types/api.types";

/**
 * What /courses asks the API for, in one place: the browser builds its
 * queries from it, and so does the server, which reads the default view
 * ahead of time so the catalogue's courses are in the page's HTML (for
 * search engines, and for the first paint). The two have to build the same
 * filters, or the server's answer sits under a key the browser never reads.
 */

/** Courses per page, once one status is chosen. */
export const CATALOGUE_PAGE_SIZE = 12;

/** Courses each status's section shows before "See all": two rows of the widest grid. */
export const CATALOGUE_SECTION_SIZE = 8;

/**
 * Every option here maps to a column the API's `courseSortableFields`
 * allow-list accepts. Adding one without adding the column there means the
 * sort silently falls back to the endpoint default.
 */
export const CATALOGUE_SORTS = [
    // The main programmes an admin featured first, then the newest.
    { value: "", label: "Recommended", sortBy: "featured", sortOrder: "desc" },
    { value: "newest", label: "Newest first", sortBy: "createdAt", sortOrder: "desc" },
    { value: "oldest", label: "Oldest first", sortBy: "createdAt", sortOrder: "asc" },
    { value: "price-low", label: "Price: low to high", sortBy: "price", sortOrder: "asc" },
    { value: "price-high", label: "Price: high to low", sortBy: "price", sortOrder: "desc" },
    { value: "title", label: "Title: A–Z", sortBy: "title", sortOrder: "asc" },
] as const;

export type CatalogueSort = (typeof CATALOGUE_SORTS)[number];

/** The catalogue's filters as the address holds them. Empty means "any". */
export interface CatalogueView {
    searchTerm?: string;
    categoryId?: string;
    level?: string;
    /** A chosen status: then it's the one section, a page at a time. */
    phase?: CoursePhase;
    pricing?: string;
    delivery?: string;
    mode?: string;
    sort: CatalogueSort;
    page?: number;
}

/** The API query for one status's section of the catalogue. */
export const sectionFilters = (sectionPhase: CoursePhase, view: CatalogueView) => ({
    searchTerm: view.searchTerm || undefined,
    categoryId: view.categoryId || undefined,
    level: view.level || undefined,
    phase: sectionPhase,
    pricing: view.pricing,
    delivery: view.delivery,
    mode: view.mode,
    sortBy: view.sort.sortBy,
    sortOrder: view.sort.sortOrder,
    page: view.phase ? (view.page ?? 1) : 1,
    limit: view.phase ? CATALOGUE_PAGE_SIZE : CATALOGUE_SECTION_SIZE,
});

export type SectionFilters = ReturnType<typeof sectionFilters>;

/** The query string the browser's client sends for these filters: unset ones left out. */
export const filtersQuery = (filters: SectionFilters) =>
    new URLSearchParams(
        Object.entries(filters).flatMap(([key, value]) => (value === undefined ? [] : [[key, String(value)]])),
    ).toString();
