import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { createAccount, owner } from "../helpers/fixtures";

/**
 * Accounts are only ever soft-deleted. As a second line of defence, the
 * database refuses to remove a central account that still owns financial or
 * credential learning records (orders — and through them payments —,
 * enrollments, certificates).
 */

const deleteRule = async (table: string, column: string) => {
    const { rows } = await owner.query(
        `SELECT con.confdeltype AS rule
         FROM pg_constraint con
         JOIN pg_class cl ON cl.oid = con.conrelid
         JOIN pg_namespace ns ON ns.oid = cl.relnamespace
         JOIN pg_attribute att ON att.attrelid = cl.oid AND att.attnum = ANY (con.conkey)
         WHERE con.contype = 'f' AND ns.nspname = 'learning' AND cl.relname = $1 AND att.attname = $2`,
        [table, column],
    );
    return rows[0]?.rule;
};

describe("learning records and account deletion", () => {
    it.each([
        ["order", "studentId"],
        ["enrollment", "studentId"],
        ["certificate", "studentId"],
    ])("learning.%s.%s is ON DELETE RESTRICT", async (table, column) => {
        expect(await deleteRule(table, column)).toBe("r");
    });

    it("keeps progress-style records cascading (they mean nothing without the account)", async () => {
        expect(await deleteRule("video_progress", "studentId")).toBe("c");
    });

    it("refuses to hard-delete an account that has an order", async () => {
        const student = await createAccount("STUDENT");
        const courseId = randomUUID();
        await owner.query(
            `INSERT INTO learning.course (id, title, slug, description, "updatedAt") VALUES ($1, 'Course', $2, 'D', now())`,
            [courseId, `course-${courseId}`],
        );
        await owner.query(
            `INSERT INTO learning."order" (id, "orderNumber", "studentId", "courseId", amount, total, "updatedAt")
             VALUES ($1, $2, $3, $4, 1000, 1000, now())`,
            [randomUUID(), `ORD-${courseId.slice(0, 8)}`, student.id, courseId],
        );

        await expect(owner.query(`DELETE FROM learning."user" WHERE id = $1`, [student.id])).rejects.toThrow(/order_studentId_fkey/);
    });
});
