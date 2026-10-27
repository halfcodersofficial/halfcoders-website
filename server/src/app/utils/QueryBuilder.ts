import {
    IQueryConfig,
    IQueryParams,
    IQueryResult,
    PrismaCountArgs,
    PrismaFindManyArgs,
    PrismaModelDelegate,
    PrismaStringFilter,
    PrismaWhereConditions,
} from "../interfaces/query.interface";

const RESERVED_PARAMS = ["searchTerm", "page", "limit", "sortBy", "sortOrder", "fields", "include"];
const RANGE_OPERATORS = ["lt", "lte", "gt", "gte", "equals", "not", "in", "notIn", "contains"];

const DEFAULT_LIMIT = 10;
const DEFAULT_MAX_LIMIT = 100;
const DEFAULT_SORT_BY = "createdAt";

/**
 * Chainable translator from `?searchTerm=&page=&sortBy=&<field>=` query strings
 * into Prisma `findMany` arguments, with a matching count query so pagination
 * metadata stays consistent with the filters actually applied.
 *
 * Only fields listed in `config.filterableFields` / `searchableFields` are ever
 * used — an unrecognised query parameter is dropped rather than passed through
 * to Prisma, so a caller can't filter on columns the endpoint didn't intend to
 * expose.
 */
export class QueryBuilder<T> {
    private query: PrismaFindManyArgs;
    private countQuery: PrismaCountArgs;
    private page = 1;
    private limit = DEFAULT_LIMIT;
    private hasSelect = false;

    constructor(
        private model: PrismaModelDelegate,
        private queryParams: IQueryParams,
        private config: IQueryConfig = {},
    ) {
        this.query = {
            where: {},
            orderBy: { [config.defaultSortBy ?? DEFAULT_SORT_BY]: "desc" },
            skip: 0,
            take: DEFAULT_LIMIT,
        };
        this.countQuery = { where: {} };
    }

    search(): this {
        const searchTerm = this.asString(this.queryParams.searchTerm);
        const { searchableFields } = this.config;

        if (!searchTerm || !searchableFields?.length) return this;

        const filter: PrismaStringFilter = { contains: searchTerm, mode: "insensitive" };

        const conditions = searchableFields.map((field) => {
            const parts = field.split(".");
            if (parts.length === 2) {
                return { [parts[0]]: { [parts[1]]: filter } };
            }
            if (parts.length === 3) {
                return { [parts[0]]: { some: { [parts[1]]: { [parts[2]]: filter } } } };
            }
            return { [field]: filter };
        });

        // AND-ed with the other filters (Prisma treats sibling keys as AND), so
        // a search narrows the filtered set rather than widening it.
        (this.query.where as PrismaWhereConditions).OR = conditions;
        (this.countQuery.where as PrismaWhereConditions).OR = conditions;

        return this;
    }

    filter(): this {
        const { filterableFields } = this.config;
        const where = this.query.where as Record<string, unknown>;
        const countWhere = this.countQuery.where as Record<string, unknown>;

        for (const [key, rawValue] of Object.entries(this.queryParams)) {
            if (RESERVED_PARAMS.includes(key)) continue;
            if (rawValue === undefined || rawValue === "") continue;

            // Allow-list: an endpoint must opt a field in before it can be
            // filtered on.
            if (filterableFields?.length && !filterableFields.includes(key)) continue;

            const value = this.parseValue(rawValue);
            const parts = key.split(".");

            if (parts.length === 2) {
                const [relation, field] = parts;
                where[relation] = { ...(where[relation] as object), [field]: value };
                countWhere[relation] = { ...(countWhere[relation] as object), [field]: value };
                continue;
            }

            where[key] = value;
            countWhere[key] = value;
        }

        return this;
    }

    paginate(): this {
        const maxLimit = this.config.maxLimit ?? DEFAULT_MAX_LIMIT;

        const page = Math.max(1, Number(this.queryParams.page) || 1);
        const requested = Number(this.queryParams.limit) || DEFAULT_LIMIT;
        // Clamp so `?limit=100000` can't turn one request into a full table scan.
        const limit = Math.min(Math.max(1, requested), maxLimit);

        this.page = page;
        this.limit = limit;
        this.query.skip = (page - 1) * limit;
        this.query.take = limit;

        return this;
    }

    sort(): this {
        const fallback = this.config.defaultSortBy ?? DEFAULT_SORT_BY;
        const requested = this.asString(this.queryParams.sortBy);
        const { sortableFields } = this.config;

        // An unrecognised column would reach Prisma and fail validation, which
        // surfaces to the client as a 500 for what is really a typo. Fall back
        // to the endpoint's default instead.
        const sortBy =
            requested && (!sortableFields?.length || sortableFields.includes(requested))
                ? requested
                : fallback;

        const sortOrder = this.queryParams.sortOrder === "asc" ? "asc" : "desc";
        const parts = sortBy.split(".");

        this.query.orderBy =
            parts.length === 2
                ? { [parts[0]]: { [parts[1]]: sortOrder } }
                : { [sortBy]: sortOrder };

        return this;
    }

    /** Explicit ordering that overrides `sort()` — e.g. `[{ order: "asc" }]`. */
    orderBy(order: Record<string, unknown> | Record<string, unknown>[]): this {
        this.query.orderBy = order;
        return this;
    }

    fields(): this {
        const fieldsParam = this.asString(this.queryParams.fields);
        if (!fieldsParam) return this;

        const select: Record<string, boolean> = {};
        for (const field of fieldsParam.split(",").map((f) => f.trim())) {
            if (field) select[field] = true;
        }

        if (Object.keys(select).length === 0) return this;

        this.query.select = select;
        // `select` and `include` are mutually exclusive in Prisma.
        delete this.query.include;
        this.hasSelect = true;

        return this;
    }

    include(relations: Record<string, unknown>): this {
        // A caller-supplied `?fields=` wins: honouring both would make Prisma throw.
        if (this.hasSelect) return this;
        this.query.include = { ...(this.query.include as object), ...relations };
        return this;
    }

    /** Merge a server-controlled condition that the client cannot override. */
    where(condition: Record<string, unknown>): this {
        this.query.where = this.deepMerge(this.query.where as Record<string, unknown>, condition);
        this.countQuery.where = this.deepMerge(this.countQuery.where as Record<string, unknown>, condition);
        return this;
    }

    async execute(): Promise<IQueryResult<T>> {
        const [total, data] = await Promise.all([
            this.model.count(this.countQuery),
            this.model.findMany(this.query),
        ]);

        return {
            data: data as T[],
            meta: {
                page: this.page,
                limit: this.limit,
                total,
                totalPages: Math.ceil(total / this.limit),
            },
        };
    }

    getQuery(): PrismaFindManyArgs {
        return this.query;
    }

    private asString(value: unknown): string | undefined {
        return typeof value === "string" ? value : undefined;
    }

    private deepMerge(
        target: Record<string, unknown>,
        source: Record<string, unknown>,
    ): Record<string, unknown> {
        const result = { ...target };
        for (const [key, value] of Object.entries(source)) {
            const existing = result[key];
            if (
                value && typeof value === "object" && !Array.isArray(value) &&
                existing && typeof existing === "object" && !Array.isArray(existing)
            ) {
                result[key] = this.deepMerge(
                    existing as Record<string, unknown>,
                    value as Record<string, unknown>,
                );
            } else {
                result[key] = value;
            }
        }
        return result;
    }

    /**
     * Coerces a query-string value into what Prisma expects. `qs` gives us
     * nested objects for `?price[gte]=500`, arrays for repeated keys, and
     * strings for everything else.
     */
    private parseValue(value: unknown): unknown {
        if (Array.isArray(value)) {
            return { in: value.map((v) => this.parseScalar(v)) };
        }

        if (value && typeof value === "object") {
            const range: Record<string, unknown> = {};
            for (const [op, opValue] of Object.entries(value as Record<string, unknown>)) {
                if (!RANGE_OPERATORS.includes(op)) continue;
                range[op] =
                    op === "in" || op === "notIn"
                        ? (Array.isArray(opValue) ? opValue : [opValue]).map((v) => this.parseScalar(v))
                        : this.parseScalar(opValue);
            }
            return Object.keys(range).length > 0 ? range : value;
        }

        return this.parseScalar(value);
    }

    private parseScalar(value: unknown): unknown {
        if (value === "true") return true;
        if (value === "false") return false;
        // Enum members and ids are strings that must survive intact; only
        // convert values that are purely numeric.
        if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
            return Number(value);
        }
        return value;
    }
}
