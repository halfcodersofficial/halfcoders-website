import status from "http-status";
import AppError from "../errorHelpers/AppError";

/**
 * Curriculum rows carry a `@@unique([parentId, order])` constraint so the
 * learning page can rely on the sequence being gap-free and unambiguous. That
 * constraint makes naive reordering impossible: a single UPDATE that shifts
 * several rows trips the unique index mid-statement, because Postgres checks
 * it per row rather than at commit.
 *
 * The fix is two passes inside one transaction — move every affected row to a
 * negative placeholder (which no real row ever uses), then write the final
 * positions. Callers pass an `update` function bound to the right Prisma
 * delegate and transaction client.
 */
export const applyOrdering = async (
    orderedIds: string[],
    update: (id: string, order: number) => Promise<unknown>,
): Promise<void> => {
    // Pass 1 — park everything out of the way of the unique index.
    for (const [index, id] of orderedIds.entries()) {
        await update(id, -(index + 1));
    }

    // Pass 2 — write the real 1-based positions.
    for (const [index, id] of orderedIds.entries()) {
        await update(id, index + 1);
    }
};

/**
 * Validates that a reorder request covers exactly the rows that exist — no
 * missing ids (which would leave rows parked at negative positions) and no
 * foreign ids (which would silently fail or touch another course's rows).
 */
export const assertCompleteOrdering = (orderedIds: string[], existingIds: string[]) => {
    const requested = new Set(orderedIds);

    if (requested.size !== orderedIds.length) {
        throw new AppError(status.BAD_REQUEST, "The ordering contains duplicate ids.");
    }

    if (orderedIds.length !== existingIds.length || !existingIds.every((id) => requested.has(id))) {
        throw new AppError(
            status.BAD_REQUEST,
            "The ordering must list every item exactly once, and nothing else.",
        );
    }
};
