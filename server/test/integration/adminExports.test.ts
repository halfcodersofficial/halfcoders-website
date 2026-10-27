import { beforeAll, describe, expect, it } from "vitest";
import { api, createAccount, owner, type TestAccount } from "../helpers/fixtures";
import { createCourse, enrol } from "../helpers/learning";

/**
 * The admin lists as CSV files: same filters as the screen, every row, and a
 * name typed as a spreadsheet formula can't run as one.
 */
describe("admin CSV exports", () => {
    let admin: TestAccount;
    let mentor: TestAccount;
    let sneaky: TestAccount;
    let plain: TestAccount;
    let courseId: string;

    beforeAll(async () => {
        [admin, mentor, sneaky, plain] = await Promise.all([
            createAccount("ADMIN"),
            createAccount("MENTOR"),
            createAccount("STUDENT"),
            createAccount("STUDENT"),
        ]);
        await owner.query(`UPDATE learning."user" SET name = $1 WHERE id = $2`, ['=HYPERLINK("http://evil.test","Click")', sneaky.id]);
        courseId = (await createCourse({ title: "Exported, course" })).id;
        await enrol(sneaky.id, courseId, "ACTIVE");
        await enrol(plain.id, courseId, "COMPLETED");
        // Students reach the register through a learning profile, made on first sign-in.
        for (const student of [sneaky, plain]) await api().get("/api/v1/auth/me").set("Cookie", student.cookie);
    });

    const download = (path: string, account = admin) => api().get(path).set("Cookie", account.cookie);
    const lines = (text: string) => text.replace(/^\uFEFF/, "").split("\r\n");

    it("sends the enrolments as a CSV download with a header row and every match", async () => {
        const res = await download(`/api/v1/enrollments/manage/export?courseId=${courseId}`);
        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toMatch(/text\/csv/);
        expect(res.headers["content-disposition"]).toMatch(/attachment; filename="enrolments-\d{4}-\d{2}-\d{2}\.csv"/);
        const rows = lines(res.text);
        expect(rows[0]).toMatch(/^Student,Email,Phone,Course,Status/);
        expect(rows).toHaveLength(3);
        // A comma in a value is quoted, not split.
        expect(res.text).toContain('"Exported, course"');
    });

    it("applies the list's filters", async () => {
        const res = await download(`/api/v1/enrollments/manage/export?courseId=${courseId}&status=COMPLETED`);
        const rows = lines(res.text);
        expect(rows).toHaveLength(2);
        expect(rows[1]).toContain(plain.email);
    });

    it("defuses a name typed as a formula", async () => {
        const res = await download(`/api/v1/enrollments/manage/export?courseId=${courseId}`);
        expect(res.text).toContain(`"'=HYPERLINK(""http://evil.test"",""Click"")"`);
        expect(res.text).not.toMatch(/(^|,)=HYPERLINK/m);
    });

    it("exports the student register, orders and certificates too", async () => {
        const students = await download(`/api/v1/users/students/export?courseId=${courseId}`);
        expect(students.status).toBe(200);
        expect(lines(students.text)[0]).toMatch(/^Student ID,Name,Email/);
        expect(students.text).toContain(plain.email);

        const orders = await download("/api/v1/orders/manage/export");
        expect(orders.status).toBe(200);
        expect(lines(orders.text)[0]).toMatch(/^Order,Placed,Status,Student/);

        const certificates = await download("/api/v1/certificates/manage/export");
        expect(certificates.status).toBe(200);
        expect(lines(certificates.text)[0]).toMatch(/^Certificate,Student,Email,Course/);
    });

    it("is for admins only", async () => {
        for (const path of ["/api/v1/enrollments/manage/export", "/api/v1/users/students/export", "/api/v1/orders/manage/export", "/api/v1/certificates/manage/export"]) {
            expect((await download(path, mentor)).status).toBe(403);
        }
    });
});
