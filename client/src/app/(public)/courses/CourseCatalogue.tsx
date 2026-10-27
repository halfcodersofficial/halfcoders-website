"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import {
    ArrowRight,
    ArrowUpDown,
    BookOpen,
    CalendarClock,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Gauge,
    Layers,
    LayoutGrid,
    List,
    MapPin,
    MonitorPlay,
    Search,
    SearchX,
    ServerCrash,
    Shapes,
    Sparkles,
    Tag,
    X,
    type LucideIcon,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import BundleCard from "@/components/shared/BundleCard";
import CategoryIcon from "@/components/shared/CategoryIcon";
import CourseCard, { CourseCardSkeleton } from "@/components/shared/CourseCard";
import { PhaseDot } from "@/components/shared/CourseClassification";
import CourseListRow, { CourseListRowSkeleton } from "@/components/shared/CourseListRow";
import { CARD_GRID } from "@/components/site/CardGrid";
import { Eyebrow } from "@/components/site/code";
import { FileIcon } from "@/components/site/EditorWindow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { catalogueService } from "@/services";
import {
    asMember,
    CLASS_MODES,
    COURSE_DELIVERIES,
    COURSE_MODES,
    COURSE_PHASES,
    COURSE_PRICINGS,
    DELIVERY_META,
    MODE_META,
    PHASE_META,
    PRICING_META,
} from "@/lib/courseClassification";
import { scrollPageTo } from "@/lib/smoothScroll";
import { cn } from "@/lib/utils";
import type { ApiMeta, CoursePhase } from "@/types/api.types";
import type { CourseCard as CourseCardType, PublicBundle } from "@/types/domain.types";

type ViewMode = "grid" | "list";

/** Courses per page, once one status is chosen. */
const LIMIT = 12;

/** Courses each status's section shows before "See all" — two rows of the widest grid. */
const SECTION_LIMIT = 8;

/** The results' top, for "page 2" and the hero's quick picks to bring into view. */
const RESULTS_ID = "results";

/** A menu's "everything" choice — Radix radio items need a non-empty value. */
const ALL = "all";

/**
 * First, last, current ±1, and an ellipsis over any gap — the numbered strip
 * a catalogue this size needs instead of just "Page 3 of 8", without ever
 * rendering all eight buttons at once.
 */
const paginationRange = (current: number, total: number): (number | "…")[] => {
    const pages: number[] = [];
    for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || Math.abs(i - current) <= 1) pages.push(i);
    }

    const withDots: (number | "…")[] = [];
    let previous: number | undefined;
    for (const page of pages) {
        if (previous !== undefined && page - previous > 1) withDots.push("…");
        withDots.push(page);
        previous = page;
    }
    return withDots;
};

const LEVELS = [
    { value: "", label: "All levels", dot: null },
    { value: "BEGINNER", label: "Beginner", dot: "bg-success" },
    { value: "INTERMEDIATE", label: "Intermediate", dot: "bg-primary" },
    { value: "ADVANCED", label: "Advanced", dot: "bg-destructive" },
] as const;

/**
 * Every option here maps to a column the API's `courseSortableFields`
 * allow-list accepts. Adding one without adding the column there means the
 * sort silently falls back to the endpoint default.
 */
const SORTS = [
    // The main programmes an admin featured first, then the newest.
    { value: "", label: "Recommended", sortBy: "featured", sortOrder: "desc" },
    { value: "newest", label: "Newest first", sortBy: "createdAt", sortOrder: "desc" },
    { value: "oldest", label: "Oldest first", sortBy: "createdAt", sortOrder: "asc" },
    { value: "price-low", label: "Price: low to high", sortBy: "price", sortOrder: "asc" },
    { value: "price-high", label: "Price: high to low", sortBy: "price", sortOrder: "desc" },
    { value: "title", label: "Title: A–Z", sortBy: "title", sortOrder: "asc" },
] as const;

/** Bring the results' top into view, just under the bar and the filter rail stuck beneath it. */
const scrollToResults = () => {
    const results = document.getElementById(RESULTS_ID);
    if (!results) return;
    const covered =
        (document.querySelector("header")?.getBoundingClientRect().height ?? 0) +
        (document.querySelector("[data-filter-rail]")?.getBoundingClientRect().height ?? 0);
    scrollPageTo(results.getBoundingClientRect().top + window.scrollY - covered);
};

/** Typing somewhere that takes text — "/" there is a character, not a shortcut. */
const typingIn = (target: EventTarget | null) =>
    target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * The catalogue, dressed as a workspace. Up top, on the dark editor surface,
 * in Bangla: the question, and the search — the page's one main action —
 * beside a small panel of what learning here means.
 * Fixed words: no figures from the API.
 *
 * Under that one toolbar that sticks under the bar: a Courses / Bundles
 * switch first (Bundles shows the bundles on sale instead, the course filters
 * hidden), then Category, Level, Status,
 * Price, Format and Mode as "Name: choice" dropdowns, and Sort and grid/list at
 * the end. There's one search, the header's; "/" anywhere jumps into it, back
 * up the page if it's scrolled away.
 *
 * The results come in a section per status — running courses first, then
 * upcoming, then previous (recorded) — each its first few with "See all",
 * which picks that status: then it's the one section, a page at a time.
 *
 * Every filter lives in the URL, so a filtered list can be shared and the
 * back button undoes a filter. Changing one keeps your place, and the last
 * results stay up, faded, until the new ones arrive — no flash of blank
 * cards; a new page or a search brings the results into view. No course
 * counts anywhere — the filters in force show above the results instead.
 */
function CoursesBrowser() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const searchRef = useRef<HTMLInputElement>(null);

    const categoryId = searchParams.get("categoryId") ?? "";
    const level = searchParams.get("level") ?? "";
    const phase = asMember(COURSE_PHASES, searchParams.get("phase"));
    const pricing = asMember(COURSE_PRICINGS, searchParams.get("pricing"));
    const delivery = asMember(COURSE_DELIVERIES, searchParams.get("delivery"));
    const mode = asMember(COURSE_MODES, searchParams.get("mode"));
    const sort = searchParams.get("sort") ?? "";
    const view: ViewMode = searchParams.get("view") === "list" ? "list" : "grid";
    // The catalogue lists courses, or — switched to "Bundles" — the bundles on sale.
    const showBundles = searchParams.get("type") === "bundles";
    const page = Number(searchParams.get("page") ?? 1);

    // Kept in local state so typing doesn't push a history entry per keystroke;
    // the URL is only updated on submit.
    const [searchInput, setSearchInput] = useState(searchParams.get("searchTerm") ?? "");
    const searchTerm = searchParams.get("searchTerm") ?? "";

    const { data: categories } = useQuery({
        queryKey: ["categories"],
        queryFn: catalogueService.categories,
        staleTime: 10 * 60_000,
    });

    const activeSort = SORTS.find((option) => option.value === sort) ?? SORTS[0];

    const bundles = useQuery({
        queryKey: ["bundles"],
        queryFn: catalogueService.bundles,
        staleTime: 60_000,
        enabled: showBundles,
    });

    // With a status chosen, that one, a page at a time; otherwise a section
    // per status, in the catalogue's order, each its first few.
    const sectionPhases: readonly CoursePhase[] = phase ? [phase] : COURSE_PHASES;
    const results = useQueries({
        queries: sectionPhases.map((sectionPhase) => {
            const filters = {
                searchTerm: searchTerm || undefined,
                categoryId: categoryId || undefined,
                level: level || undefined,
                phase: sectionPhase,
                pricing,
                delivery,
                mode,
                sortBy: activeSort.sortBy,
                sortOrder: activeSort.sortOrder,
                page: phase ? page : 1,
                limit: phase ? LIMIT : SECTION_LIMIT,
            };
            return {
                queryKey: ["courses", filters],
                queryFn: () => catalogueService.courses(filters),
                // The last results stay up while the next arrive.
                placeholderData: keepPreviousData,
                enabled: !showBundles,
            };
        }),
    });
    const isLoading = results.some((result) => result.isLoading);
    const isError = results.some((result) => result.isError);
    const isRefetching = results.some((result) => result.isRefetching);
    const isPlaceholderData = results.some((result) => result.isPlaceholderData);
    const refetch = () => results.forEach((result) => void result.refetch());

    // "/" jumps into the search — taking the page back up to it if it's scrolled out of view.
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const search = searchRef.current;
            if (!search || event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || typingIn(event.target)) return;
            event.preventDefault();
            if (search.getBoundingClientRect().bottom < 80) scrollPageTo(0);
            search.focus({ preventScroll: true });
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const setParam = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value) params.set(key, value);
        else params.delete(key);
        // Any filter change invalidates the current page number — switching
        // how the same results are displayed doesn't.
        if (key !== "page" && key !== "view") params.delete("page");
        router.push(`/courses?${params.toString()}`, { scroll: false });
    };

    const submitSearch = () => {
        setParam("searchTerm", searchInput.trim());
        scrollToResults();
    };

    const clearAll = () => {
        setSearchInput("");
        router.push("/courses", { scroll: false });
    };

    // The sections with something in them; an empty status has no section.
    const sections = sectionPhases
        .map((sectionPhase, index) => ({
            phase: sectionPhase,
            courses: results[index]?.data?.data ?? [],
            meta: results[index]?.data?.meta,
        }))
        .filter((section) => section.courses.length > 0);

    const activeCategory = categories?.find((category) => category.id === categoryId);
    const activeLevel = LEVELS.find((option) => option.value === level && option.value);
    const hasFilters = Boolean(searchTerm || categoryId || level || phase || pricing || delivery || mode);

    const categoryOptions: MenuOption[] = [
        { value: ALL, label: "All categories" },
        ...(categories ?? []).map((category) => ({
            value: category.id,
            label: category.title,
            icon: <CategoryIcon name={category.icon} className="size-4 text-muted-foreground" />,
        })),
    ];
    const levelOptions: MenuOption[] = LEVELS.map((option) => ({
        value: option.value || ALL,
        label: option.label,
        icon: option.dot ? <span aria-hidden className={cn("mx-1 size-2 rounded-full", option.dot)} /> : undefined,
    }));
    const phaseOptions: MenuOption[] = [
        { value: ALL, label: "Any status" },
        ...COURSE_PHASES.map((value) => ({
            value,
            label: value === "PREVIOUS" ? "Previous (recorded)" : PHASE_META[value].card,
            icon: <PhaseDot phase={value} className="mx-1 size-2" />,
        })),
    ];
    const pricingOptions: MenuOption[] = [
        { value: ALL, label: "Free & paid" },
        ...COURSE_PRICINGS.map((value) => ({ value, label: PRICING_META[value].label })),
    ];
    const deliveryOptions: MenuOption[] = [
        { value: ALL, label: "Any format" },
        ...COURSE_DELIVERIES.map((value) => {
            const { icon: Icon, label } = DELIVERY_META[value];
            return { value, label, icon: <Icon className="size-4 text-muted-foreground" /> };
        }),
    ];
    // Online and offline only: a course that runs both lists under either.
    const modeOptions: MenuOption[] = [
        { value: ALL, label: "Online or offline" },
        ...CLASS_MODES.map((value) => {
            const { icon: Icon, label } = MODE_META[value];
            return { value, label, icon: <Icon className="size-4 text-muted-foreground" /> };
        }),
    ];
    const sortOptions: MenuOption[] = SORTS.map((option) => ({ value: option.value || ALL, label: option.label }));

    return (
        <>
            <section lang="bn" data-nav-tone="dark" className="editor relative overflow-hidden border-b border-editor-line">
                <div aria-hidden className="bg-grid bg-grid-fade pointer-events-none absolute inset-0" />

                <div className="container-page relative grid grid-cols-1 gap-10 py-12 sm:py-14 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
                    <div>
                        <Eyebrow className="mb-4">সব কোর্স</Eyebrow>
                        <h1 className="text-h1 text-balance">
                            কোন কোর্স দিয়ে <span className="squiggle">শুরু করবেন?</span>
                        </h1>
                        <p className="mt-4 max-w-xl text-lg leading-relaxed text-editor-muted">
                            সব কোর্সে ক্লাস বাংলায়, প্রতিটা অ্যাসাইনমেন্ট মেন্টর নিজে রিভিউ করেন, আর শেষে পাবেন আইডিসহ সার্টিফিকেট। নাম লিখে খুঁজুন,
                            অথবা নিচের ফিল্টার দিয়ে বেছে নিন।
                        </p>

                        <form
                            role="search"
                            className="mt-8 flex max-w-2xl items-center gap-2 rounded-md border border-editor-line bg-editor-panel p-1.5 pl-4 transition-shadow focus-within:border-violet-400 focus-within:shadow-[0_0_0_3px_rgb(139_77_255/0.25)]"
                            onSubmit={(event) => {
                                event.preventDefault();
                                submitSearch();
                            }}
                        >
                            <Search className="size-4 shrink-0 text-editor-muted" aria-hidden />
                            <Input
                                ref={searchRef}
                                type="search"
                                value={searchInput}
                                onChange={(event) => setSearchInput(event.target.value)}
                                placeholder="কোর্সের নাম…"
                                className="h-10 min-w-0 flex-1 border-none bg-transparent px-1 text-base text-editor-fg shadow-none placeholder:text-editor-gutter focus-visible:ring-0"
                                aria-label="কোর্স খুঁজুন"
                                aria-keyshortcuts="/"
                            />
                            {/* The shortcut, for anyone with a keyboard. */}
                            <kbd className="hidden shrink-0 rounded-sm border border-editor-line px-1.5 py-0.5 font-mono text-xs text-editor-muted lg:inline">
                                /
                            </kbd>
                            <Button type="submit" variant="enroll" lang="en" className="shrink-0">
                                Search
                            </Button>
                        </form>
                    </div>

                    <CatalogueConfig />
                </div>
            </section>

            {/* The toolbar — one row, sticky under the bar, so a long scroll never strands a student without the filters. */}
            <div data-filter-rail className="sticky top-16 z-30 border-b border-border bg-background/95 backdrop-blur-md">
                {/* Phones: one row you swipe along, so the sticky bar stays one line tall. */}
                <div className="container-page no-scrollbar flex items-center gap-2 overflow-x-auto py-3 sm:flex-wrap sm:overflow-visible">
                    <TypeSwitch bundles={showBundles} onChange={(next) => setParam("type", next ? "bundles" : "")} />
                    {!showBundles && (
                        <>
                            <FilterMenu
                                label="Category"
                                icon={Shapes}
                                options={categoryOptions}
                                value={categoryId || ALL}
                                onChange={(value) => setParam("categoryId", value === ALL ? "" : value)}
                            />
                            <FilterMenu
                                label="Level"
                                icon={Gauge}
                                options={levelOptions}
                                value={level || ALL}
                                onChange={(value) => setParam("level", value === ALL ? "" : value)}
                            />
                            <FilterMenu
                                label="Status"
                                icon={CalendarClock}
                                options={phaseOptions}
                                value={phase ?? ALL}
                                onChange={(value) => setParam("phase", value === ALL ? "" : value)}
                            />
                            <FilterMenu
                                label="Price"
                                icon={Tag}
                                options={pricingOptions}
                                value={pricing ?? ALL}
                                onChange={(value) => setParam("pricing", value === ALL ? "" : value)}
                            />
                            <FilterMenu
                                label="Format"
                                icon={MonitorPlay}
                                options={deliveryOptions}
                                value={delivery ?? ALL}
                                onChange={(value) => setParam("delivery", value === ALL ? "" : value)}
                            />
                            <FilterMenu
                                label="Mode"
                                icon={MapPin}
                                options={modeOptions}
                                value={mode ?? ALL}
                                onChange={(value) => setParam("mode", value === ALL ? "" : value)}
                            />

                            <div className="ml-auto flex shrink-0 items-center gap-2">
                                <FilterMenu
                                    label="Sort"
                                    icon={ArrowUpDown}
                                    options={sortOptions}
                                    value={sort || ALL}
                                    onChange={(value) => setParam("sort", value === ALL ? "" : value)}
                                    align="end"
                                    quiet
                                />
                                <ViewToggle view={view} onChange={(next) => setParam("view", next === "grid" ? "" : "list")} />
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div id={RESULTS_ID} className="container-page py-8 sm:py-10">
                {/* The filters in force, each removable. Without these it's easy to land
                    here from a category link and not realise the list is filtered. */}
                {hasFilters && !showBundles && (
                    <div className="mb-8 flex flex-wrap items-center gap-2">
                        {searchTerm && (
                            <ActiveFilter
                                label={`“${searchTerm}”`}
                                onClear={() => {
                                    setSearchInput("");
                                    setParam("searchTerm", "");
                                }}
                            />
                        )}
                        {activeCategory && <ActiveFilter label={activeCategory.title} onClear={() => setParam("categoryId", "")} />}
                        {activeLevel && <ActiveFilter label={activeLevel.label} onClear={() => setParam("level", "")} />}
                        {phase && <ActiveFilter label={PHASE_META[phase].card} onClear={() => setParam("phase", "")} />}
                        {pricing && <ActiveFilter label={PRICING_META[pricing].label} onClear={() => setParam("pricing", "")} />}
                        {delivery && <ActiveFilter label={DELIVERY_META[delivery].label} onClear={() => setParam("delivery", "")} />}
                        {mode && <ActiveFilter label={MODE_META[mode].label} onClear={() => setParam("mode", "")} />}
                        <Button variant="ghost" size="sm" onClick={clearAll}>
                            Reset filters
                        </Button>
                    </div>
                )}

                {showBundles ? (
                    <BundleResults
                        bundles={bundles.data}
                        isLoading={bundles.isLoading}
                        isError={bundles.isError}
                        onRetry={() => void bundles.refetch()}
                    />
                ) : isLoading ? (
                    view === "list" ? (
                        <div className="flex flex-col gap-5">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <CourseListRowSkeleton key={index} />
                            ))}
                        </div>
                    ) : (
                        <div className={CARD_GRID}>
                            {Array.from({ length: 8 }).map((_, index) => (
                                <CourseCardSkeleton key={index} />
                            ))}
                        </div>
                    )
                ) : isError ? (
                    <OutputMessage
                        icon={<ServerCrash className="size-5" />}
                        tone="destructive"
                        status="সংযোগে সমস্যা"
                        title="কোর্সের লিস্ট আনা গেল না"
                        body="ইন্টারনেট সংযোগে হয়তো সমস্যা হচ্ছে। একটু পরে আবার চেষ্টা করুন।"
                    >
                        <Button variant="outline" lang="en" onClick={() => refetch()} isLoading={isRefetching}>
                            Retry
                        </Button>
                    </OutputMessage>
                ) : sections.length === 0 ? (
                    <OutputMessage
                        icon={hasFilters ? <SearchX className="size-5" /> : <Sparkles className="size-5" />}
                        status={hasFilters ? "কিছু পাওয়া যায়নি" : "এখনো কিছু নেই"}
                        title={
                            searchTerm
                                ? `“${searchTerm}” নামে কোনো কোর্স মেলেনি`
                                : hasFilters
                                  ? "এই ফিল্টারগুলোর সাথে কোনো কোর্স মেলেনি"
                                  : "নতুন কোর্স আসছে"
                        }
                        body={
                            searchTerm
                                ? "বানানটা দেখে নিন, অথবা ছোট বা অন্য কোনো শব্দে আবার খুঁজুন।"
                                : hasFilters
                                  ? "একটা-দুটো ফিল্টার সরিয়ে দেখুন, অথবা সব রিসেট করে পুরো লিস্ট দেখুন।"
                                  : "এই মুহূর্তে কোনো কোর্স খোলা নেই। কিছুদিন পর আবার দেখুন।"
                        }
                    >
                        {hasFilters && (
                            <div className="flex flex-col items-center gap-5">
                                <Button variant="outline" lang="en" onClick={clearAll}>
                                    Reset all filters
                                </Button>
                                {/* Somewhere else to look, one tap each: a category on its own, the search and level dropped. */}
                                {categories && categories.some((category) => category.id !== categoryId) && (
                                    <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
                                        <span className="text-muted-foreground">অথবা দেখুন:</span>
                                        {categories
                                            .filter((category) => category.id !== categoryId)
                                            .slice(0, 5)
                                            .map((category) => (
                                                <button
                                                    key={category.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSearchInput("");
                                                        router.push(`/courses?categoryId=${category.id}`, { scroll: false });
                                                    }}
                                                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 transition-colors hover:border-primary/40 hover:text-primary"
                                                >
                                                    <CategoryIcon name={category.icon} className="size-3.5" />
                                                    {category.title}
                                                </button>
                                            ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </OutputMessage>
                ) : (
                    // Faded while the next results load; each new set comes in with a short rise.
                    <div aria-busy={isPlaceholderData} className={cn("transition-opacity duration-200", isPlaceholderData && "opacity-50")}>
                        <div
                            key={sections.flatMap((section) => section.courses.map((course) => course.id)).join()}
                            className="space-y-16 animate-in fade-in slide-in-from-bottom-2 duration-500 motion-reduce:animate-none"
                        >
                            {sections.map((section) => (
                                <CourseSection
                                    key={section.phase}
                                    phase={section.phase}
                                    // Only while the sections are previews: a chosen status is already all of it.
                                    onSeeAll={
                                        !phase && section.meta && section.meta.total > section.courses.length
                                            ? () => {
                                                  setParam("phase", section.phase);
                                                  scrollToResults();
                                              }
                                            : undefined
                                    }
                                >
                                    <CourseResults courses={section.courses} view={view} />
                                    {phase && (
                                        <Pagination
                                            page={page}
                                            meta={section.meta}
                                            onPage={(next) => {
                                                setParam("page", String(next));
                                                scrollToResults();
                                            }}
                                        />
                                    )}
                                </CourseSection>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

/**
 * One status's courses under its own heading — a dot in the status's colour
 * (pulsing for the running ones), the Bangla title and a line on what it
 * means, over a hairline — and "See all" while it shows only its first few.
 */
function CourseSection({ phase, onSeeAll, children }: { phase: CoursePhase; onSeeAll?: () => void; children: ReactNode }) {
    const meta = PHASE_META[phase];
    const headingId = `section-${phase.toLowerCase()}`;

    return (
        <section aria-labelledby={headingId}>
            <header className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-border pb-4">
                <div lang="bn" className="min-w-0">
                    <h2 id={headingId} className="flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-[1.75rem]">
                        <PhaseDot phase={phase} pulse className="size-2.5" />
                        {meta.section}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">{meta.sectionBlurb}</p>
                </div>
                {onSeeAll && (
                    <Button variant="outline" size="sm" lang="en" onClick={onSeeAll} className="group shrink-0">
                        See all
                        <ArrowRight className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                    </Button>
                )}
            </header>
            {children}
        </section>
    );
}

/** A set of courses as tickets — the grid's, or the list's rows. */
function CourseResults({ courses, view }: { courses: CourseCardType[]; view: ViewMode }) {
    return view === "list" ? (
        <div className="flex flex-col gap-5">
            {courses.map((course) => (
                <CourseListRow key={course.id} course={course} />
            ))}
        </div>
    ) : (
        <div className={CARD_GRID}>
            {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
            ))}
        </div>
    );
}

interface MenuOption {
    value: string;
    label: string;
    icon?: ReactNode;
}

/**
 * One of the toolbar's dropdowns: a pill naming what it filters ("Status")
 * until something other than its first choice ("Any …") is picked, then
 * naming the choice ("Upcoming"), tinted — short either way, so five filters
 * and the sort stay one row. The menu lists the choices with a tick on the
 * current one. Opening it doesn't lock the page, so nothing shifts.
 * `quiet`: the sort's, which always shows its choice and never reads as a
 * filter in force.
 */
function FilterMenu({
    label,
    icon: Icon,
    options,
    value,
    onChange,
    align = "start",
    quiet,
}: {
    label: string;
    icon: LucideIcon;
    options: MenuOption[];
    value: string;
    onChange: (value: string) => void;
    align?: "start" | "end";
    quiet?: boolean;
}) {
    const current = options.find((option) => option.value === value) ?? options[0];
    const filtered = !quiet && value !== options[0]?.value;

    return (
        <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger
                aria-label={`${label}: ${current?.label}`}
                className={cn(
                    "group inline-flex h-9 max-w-full shrink-0 items-center gap-2 rounded-md border px-3 text-sm outline-none transition-colors focus-visible:ring-4 focus-visible:ring-ring/30 data-[state=open]:border-primary",
                    filtered ? "border-primary/50 bg-primary/5" : "border-border bg-card hover:border-primary/40",
                )}
            >
                <Icon className={cn("size-3.5 shrink-0", filtered ? "text-primary" : "text-muted-foreground")} aria-hidden />
                <span className="truncate">
                    <span className="text-muted-foreground">{label}:</span>{" "}
                    <span className={cn("font-medium", filtered ? "text-primary" : "text-foreground")}>
                        {quiet || filtered ? current?.label : "All"}
                    </span>
                </span>
                <ChevronDown
                    className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none"
                    aria-hidden
                />
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    align={align}
                    sideOffset={8}
                    collisionPadding={12}
                    className="z-50 max-h-[min(24rem,var(--radix-dropdown-menu-content-available-height))] min-w-56 overflow-y-auto rounded-card border border-border bg-popover p-1 text-popover-foreground shadow-panel data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
                >
                    <DropdownMenu.Label className="px-3 pb-1.5 pt-1.5 text-xs font-medium text-muted-foreground">{label}</DropdownMenu.Label>
                    <DropdownMenu.RadioGroup value={value} onValueChange={onChange}>
                        {options.map((option) => (
                            <DropdownMenu.RadioItem
                                key={option.value}
                                value={option.value}
                                className="flex cursor-pointer items-center gap-2.5 rounded-sm px-3 py-2 text-sm outline-none transition-colors data-highlighted:bg-secondary data-[state=checked]:font-semibold data-[state=checked]:text-primary"
                            >
                                {option.icon}
                                <span className="flex-1">{option.label}</span>
                                <span className="grid size-4 place-items-center">
                                    <DropdownMenu.ItemIndicator>
                                        <Check className="size-4" aria-hidden />
                                    </DropdownMenu.ItemIndicator>
                                </span>
                            </DropdownMenu.RadioItem>
                        ))}
                    </DropdownMenu.RadioGroup>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}

/** Grid or list, as a two-way switch. */
function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (view: ViewMode) => void }) {
    return (
        <div role="group" aria-label="Layout" className="flex shrink-0 items-center overflow-hidden rounded-md border border-border bg-card">
            {(
                [
                    { value: "grid", label: "Grid view", icon: LayoutGrid },
                    { value: "list", label: "List view", icon: List },
                ] as const
            ).map(({ value, label, icon: Icon }) => (
                <button
                    key={value}
                    type="button"
                    aria-pressed={view === value}
                    aria-label={label}
                    title={label}
                    onClick={() => onChange(value)}
                    className={cn(
                        "grid size-9 place-items-center transition-colors [&+&]:border-l [&+&]:border-border",
                        view === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary",
                    )}
                >
                    <Icon className="size-4" />
                </button>
            ))}
        </div>
    );
}

/** What learning here means, at a glance, beside the search. Fixed words, not figures. */
const AT_A_GLANCE = [
    { label: "ক্লাস", value: "লাইভ, রেকর্ডেড বা দুটোই" },
    { label: "ভাষা", value: "বাংলা" },
    { label: "লেভেল", value: "বিগিনার থেকে অ্যাডভান্সড" },
    { label: "আটকে গেলে", value: "মেন্টরের সাথে ১:১ সেশন" },
    { label: "শেষে", value: "যাচাইযোগ্য সার্টিফিকেট" },
];

/** A small editor panel — what every course here comes with — beside the search. */
function CatalogueConfig() {
    return (
        <section aria-label="এক নজরে" className="w-full overflow-hidden rounded-card border border-editor-line bg-editor-panel">
            <header className="flex items-center gap-2 border-b border-editor-line px-4 py-2 text-xs font-semibold text-editor-muted">
                <FileIcon name="course.config.json" />
                এক নজরে
            </header>
            <dl className="divide-y divide-editor-line">
                {AT_A_GLANCE.map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                        <dt className="shrink-0 text-editor-muted">{row.label}</dt>
                        <dd className="text-right font-semibold text-editor-fg">{row.value}</dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}

function ActiveFilter({ label, onClear }: { label: string; onClear: () => void }) {
    return (
        <Badge variant="secondary" className="gap-1.5 py-1 pr-1">
            {label}
            <button
                type="button"
                onClick={onClear}
                aria-label={`Remove ${label} filter`}
                className="grid size-4 place-items-center rounded-sm transition-colors hover:bg-foreground/10"
            >
                <X className="size-3" />
            </button>
        </Badge>
    );
}

/**
 * A message where the results would be, set as a terminal's output: a status
 * line in mono (`error: …`, `0 results`), then what happened and — under a
 * hairline — what to do about it, when there's something to do. In Bangla,
 * like the page's top; its buttons stay English.
 */
function OutputMessage({
    icon,
    status,
    title,
    body,
    tone = "primary",
    children,
}: {
    icon: ReactNode;
    status: string;
    title: string;
    body: string;
    tone?: "primary" | "destructive";
    children?: ReactNode;
}) {
    return (
        <div
            lang="bn"
            className="mx-auto max-w-2xl overflow-hidden rounded-card border border-border bg-card animate-in fade-in slide-in-from-bottom-2 duration-500 motion-reduce:animate-none"
        >
            <p
                lang="en"
                className={cn(
                    "flex items-center gap-2 border-b border-border bg-surface px-5 py-2.5 text-xs font-semibold",
                    tone === "destructive" ? "text-destructive-ink" : "text-syn-comment",
                )}
            >
                {icon}
                {status}
            </p>
            <div className="px-6 py-8 text-center sm:px-10">
                <h2 className="text-balance text-xl font-semibold sm:text-2xl">{title}</h2>
                <p className="mx-auto mt-2 max-w-md text-muted-foreground">{body}</p>
            </div>
            {children && <div className="border-t border-border bg-surface/60 px-6 py-6">{children}</div>}
        </div>
    );
}

/**
 * Courses or Bundles, as two editor tabs at the start of the toolbar. Bundles
 * hide the course filters — none of them apply to a bundle.
 */
function TypeSwitch({ bundles, onChange }: { bundles: boolean; onChange: (bundles: boolean) => void }) {
    return (
        <div role="group" aria-label="Show" className="flex shrink-0 overflow-hidden rounded-md border border-border bg-card">
            {(
                [
                    { value: false, label: "Courses", icon: BookOpen },
                    { value: true, label: "Bundles", icon: Layers },
                ] as const
            ).map(({ value, label, icon: Icon }) => (
                <button
                    key={label}
                    type="button"
                    aria-pressed={bundles === value}
                    onClick={() => onChange(value)}
                    className={cn(
                        "inline-flex h-9 items-center gap-1.5 px-3 text-sm font-medium transition-colors [&+&]:border-l [&+&]:border-border",
                        bundles === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                >
                    <Icon className="size-4" aria-hidden />
                    {label}
                </button>
            ))}
        </div>
    );
}

/** The bundles on sale, priced for whoever is looking, in the catalogue's grid. */
function BundleResults({
    bundles,
    isLoading,
    isError,
    onRetry,
}: {
    bundles: PublicBundle[] | undefined;
    isLoading: boolean;
    isError: boolean;
    onRetry: () => void;
}) {
    if (isLoading) {
        return (
            <div className={CARD_GRID}>
                {Array.from({ length: 4 }).map((_, index) => (
                    <CourseCardSkeleton key={index} />
                ))}
            </div>
        );
    }
    if (isError) {
        return (
            <OutputMessage
                icon={<ServerCrash className="size-5" />}
                tone="destructive"
                status="সংযোগে সমস্যা"
                title="বান্ডেলের লিস্ট আনা গেল না"
                body="ইন্টারনেট সংযোগে হয়তো সমস্যা হচ্ছে। একটু পরে আবার চেষ্টা করুন।"
            >
                <Button variant="outline" lang="en" onClick={onRetry}>
                    Retry
                </Button>
            </OutputMessage>
        );
    }
    if (!bundles?.length) {
        return (
            <OutputMessage
                icon={<Layers className="size-5" />}
                status="এখনো কিছু নেই"
                title="এই মুহূর্তে কোনো বান্ডেল নেই"
                body="নতুন বান্ডেল এলেই এখানে দেখা যাবে। ততক্ষণ আলাদা কোর্সগুলো দেখে নিন।"
            />
        );
    }
    return (
        <section aria-labelledby="bundles-heading">
            <header className="mb-7 border-b border-border pb-4">
                <h2 id="bundles-heading" className="flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-[1.75rem]" lang="bn">
                    <Layers className="size-5 text-primary" aria-hidden />
                    কোর্স বান্ডেল
                </h2>
                <p lang="bn" className="mt-1 text-sm text-muted-foreground">
                    কয়েকটা কোর্স একসাথে, আলাদা কেনার চেয়ে কম দামে — পেমেন্ট একবারেই।
                </p>
            </header>
            <ul className={CARD_GRID}>
                {bundles.map((bundle) => (
                    <li key={bundle.id} className="flex">
                        <BundleCard bundle={bundle} />
                    </li>
                ))}
            </ul>
        </section>
    );
}

function Pagination({ page, meta, onPage }: { page: number; meta: ApiMeta | undefined; onPage: (page: number) => void }) {
    if (!meta || meta.totalPages <= 1) return null;

    return (
        <nav className="mt-12 flex items-center justify-center gap-1.5" aria-label="Pagination">
            <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
                <ChevronLeft />
            </Button>

            {paginationRange(meta.page, meta.totalPages).map((entry, index) =>
                entry === "…" ? (
                    <span key={`dots-${index}`} className="grid size-10 place-items-center text-sm text-muted-foreground">
                        …
                    </span>
                ) : (
                    <button
                        key={entry}
                        type="button"
                        aria-current={entry === meta.page ? "page" : undefined}
                        onClick={() => onPage(entry)}
                        className={cn(
                            "grid size-10 place-items-center rounded-md border font-mono text-sm tabular-nums transition-colors",
                            entry === meta.page
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border hover:border-primary/40 hover:bg-secondary",
                        )}
                    >
                        {entry}
                    </button>
                ),
            )}

            <Button variant="outline" size="icon" disabled={page >= meta.totalPages} onClick={() => onPage(page + 1)} aria-label="Next page">
                <ChevronRight />
            </Button>
        </nav>
    );
}

export default function CourseCatalogue() {
    // `useSearchParams` requires a Suspense boundary in the app router.
    return (
        <Suspense
            fallback={
                <div className="container-page py-12">
                    <div className={CARD_GRID}>
                        {Array.from({ length: 8 }).map((_, index) => (
                            <CourseCardSkeleton key={index} />
                        ))}
                    </div>
                </div>
            }
        >
            <CoursesBrowser />
        </Suspense>
    );
}
