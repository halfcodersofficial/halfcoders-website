/* eslint-disable @typescript-eslint/no-explicit-any */

export interface PrismaFindManyArgs {
    where?: Record<string, unknown>;
    include?: Record<string, unknown>;
    select?: Record<string, boolean | Record<string, unknown>>;
    orderBy?: Record<string, unknown> | Record<string, unknown>[];
    skip?: number;
    take?: number;
    cursor?: Record<string, unknown>;
    distinct?: string[] | string;
    [key: string]: unknown;
}

export type PrismaCountArgs = PrismaFindManyArgs;

export interface PrismaModelDelegate {
    findMany(args?: any): Promise<any[]>;
    count(args?: any): Promise<number>;
}

export interface IQueryParams {
    searchTerm?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    fields?: string;
    include?: string;
    [key: string]: unknown;
}

export interface IQueryConfig {
    searchableFields?: string[];
    filterableFields?: string[];
    /** Hard ceiling on `?limit=` so a client can't ask for the whole table. */
    maxLimit?: number;
    /**
     * Column to order by when the caller doesn't say. Defaults to `createdAt`,
     * which most models have — but not all (AssignmentSubmission timestamps
     * its rows with `submittedAt`), so models without it must declare theirs.
     */
    defaultSortBy?: string;
    /**
     * Columns `?sortBy=` may name. Anything outside the list falls back to the
     * default instead of reaching Prisma, which would reject an unknown column
     * with a validation error and surface as a 500 on a plain typo.
     */
    sortableFields?: string[];
}

export interface PrismaStringFilter {
    contains?: string;
    startsWith?: string;
    endsWith?: string;
    mode?: "insensitive" | "default";
    equals?: string;
    in?: string[];
    notIn?: string[];
}

export interface PrismaWhereConditions {
    OR?: Record<string, unknown>[];
    AND?: Record<string, unknown>[];
    NOT?: Record<string, unknown>[];
    [key: string]: unknown;
}

export interface IQueryResult<T> {
    data: T[];
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
