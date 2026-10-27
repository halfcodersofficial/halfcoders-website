import { beforeAll, describe, expect, it } from "vitest";
import { api, createAccount, owner, type TestAccount } from "../helpers/fixtures";
import { assignMentor, createCourse, createMilestone, createModule, enrol } from "../helpers/learning";

const setMode = (courseId: string, mode: string) =>
    owner.query(`UPDATE learning.course SET mode = $2::learning."CourseMode" WHERE id = $1`, [courseId, mode]);
const modeOf = async (table: "course_module" | "outline_item", id: string) =>
    (await owner.query(`SELECT mode FROM learning.${table} WHERE id = $1`, [id])).rows[0]?.mode as string | null;

/**
 * A course that runs online and offline both: it lists under either filter,
 * keeps a venue, and its modules and outline items say which one each is —
 * marks only such a course can hold, dropped when it stops running both.
 */
describe("online and offline both", () => {
    let admin: TestAccount;
    let mentor: TestAccount;
    let student: TestAccount;

    beforeAll(async () => {
        [admin, mentor, student] = await Promise.all([createAccount("ADMIN"), createAccount("MENTOR"), createAccount("STUDENT")]);
        await api().get("/api/v1/auth/me").set("Cookie", student.cookie);
    });

    const updateCourse = (courseId: string, body: object) =>
        api().patch(`/api/v1/courses/manage/${courseId}`).set("Cookie", admin.cookie).send(body);
    const addModule = (milestoneId: string, body: object) =>
        api().post("/api/v1/modules").set("Cookie", mentor.cookie).send({ milestoneId, title: "Hands-on lab", ...body });
    const addWeek = async (courseId: string) =>
        (await api().post("/api/v1/outline/weeks").set("Cookie", mentor.cookie).send({ courseId })).body.data.id as string;
    const addItem = (weekId: string, body: object) =>
        api().post("/api/v1/outline/items").set("Cookie", mentor.cookie).send({ weekId, title: "Lab day", ...body });

    it("is a course mode of its own, and keeps its venue", async () => {
        const res = await api()
            .post("/api/v1/courses/manage")
            .set("Cookie", admin.cookie)
            .send({
                title: "Both ways course",
                description: "Some classes online, some at the office.",
                phase: "PRESENT",
                pricing: "PAID",
                price: 900,
                delivery: "LIVE",
                mode: "BOTH",
                venue: "Banani, Dhaka",
            });
        expect(res.status).toBe(201);
        expect(res.body.data).toMatchObject({ mode: "BOTH", venue: "Banani, Dhaka" });
    });

    it("lists under the online filter and the offline one", async () => {
        const both = await createCourse({ title: "Listed both ways", price: 500 });
        await setMode(both.id, "BOTH");

        for (const mode of ["ONLINE", "OFFLINE"]) {
            const res = await api().get(`/api/v1/courses?mode=${mode}&limit=48`);
            expect(res.status).toBe(200);
            const listed = res.body.data as { id: string; mode: string }[];
            expect(listed.map((course) => course.id)).toContain(both.id);
            expect(listed.every((course) => course.mode === mode || course.mode === "BOTH")).toBe(true);
        }
        const exact = (await api().get("/api/v1/courses?mode=BOTH&limit=48")).body.data as { mode: string }[];
        expect(exact.every((course) => course.mode === "BOTH")).toBe(true);
    });

    describe("its modules and outline items", () => {
        let course: { id: string; slug: string };
        let milestone: string;

        beforeAll(async () => {
            course = await createCourse({ title: "Marked course", price: 500 });
            await setMode(course.id, "BOTH");
            await assignMentor(course.id, mentor.id);
            milestone = await createMilestone(course.id);
        });

        it("are marked online or offline — never both", async () => {
            const offline = await addModule(milestone, { mode: "OFFLINE" });
            expect(offline.status).toBe(201);
            expect(await modeOf("course_module", offline.body.data.id)).toBe("OFFLINE");

            expect((await addModule(milestone, { mode: "BOTH" })).status).toBe(400);

            const unmarked = await addModule(milestone, {});
            expect(await modeOf("course_module", unmarked.body.data.id)).toBeNull();
            const marked = await api().patch(`/api/v1/modules/${unmarked.body.data.id}`).set("Cookie", mentor.cookie).send({ mode: "ONLINE" });
            expect(marked.status).toBe(200);
            expect(await modeOf("course_module", unmarked.body.data.id)).toBe("ONLINE");
            await api().patch(`/api/v1/modules/${unmarked.body.data.id}`).set("Cookie", mentor.cookie).send({ mode: null });
            expect(await modeOf("course_module", unmarked.body.data.id)).toBeNull();

            const week = await addWeek(course.id);
            const item = await addItem(week, { mode: "OFFLINE" });
            expect(item.status).toBe(201);
            expect(item.body.data.mode).toBe("OFFLINE");
            // A day with no module holds no class anywhere.
            const gap = await addItem(week, { kind: "NO_MODULE", title: "No module", mode: "ONLINE" });
            expect(gap.body.data.mode).toBeNull();
            const madeGap = await api().patch(`/api/v1/outline/items/${item.body.data.id}`).set("Cookie", mentor.cookie).send({ kind: "NO_MODULE" });
            expect(madeGap.body.data.mode).toBeNull();
        });

        it("show students where each module happens", async () => {
            // Added above as drafts; students see published modules only.
            await owner.query(`UPDATE learning.course_module SET "isPublished" = true WHERE "courseId" = $1`, [course.id]);
            await enrol(student.id, course.id);
            const res = await api().get(`/api/v1/learning/courses/${course.slug}`).set("Cookie", student.cookie);
            expect(res.status).toBe(200);
            const modules = res.body.data.curriculum.flatMap((week: { modules: { title: string; mode: string | null }[] }) => week.modules);
            expect(modules.map((entry: { mode: string | null }) => entry.mode)).toContain("OFFLINE");
        });

        it("come along when the outline is copied from the modules", async () => {
            const other = await createCourse({ title: "Copied course", price: 500 });
            await setMode(other.id, "BOTH");
            const week = await createMilestone(other.id);
            const moduleId = await createModule(other.id, week);
            await owner.query(`UPDATE learning.course_module SET mode = 'OFFLINE' WHERE id = $1`, [moduleId]);

            const copy = await api().post(`/api/v1/outline/course/${other.id}/copy-from-modules`).set("Cookie", admin.cookie);
            expect(copy.status).toBe(201);
            expect(copy.body.data[0].items[0]).toMatchObject({ kind: "MODULE", mode: "OFFLINE" });
        });

        it("are dropped when the course stops running both", async () => {
            const week = await addWeek(course.id);
            const item = (await addItem(week, { mode: "ONLINE" })).body.data.id as string;
            const moduleId = (await addModule(milestone, { mode: "OFFLINE" })).body.data.id as string;

            expect((await updateCourse(course.id, { title: "Marked course, renamed" })).status).toBe(200);
            expect(await modeOf("course_module", moduleId)).toBe("OFFLINE");

            expect((await updateCourse(course.id, { mode: "OFFLINE" })).status).toBe(200);
            expect(await modeOf("course_module", moduleId)).toBeNull();
            expect(await modeOf("outline_item", item)).toBeNull();
        });
    });

    it("can't be marked on a course that runs one way only", async () => {
        const online = await createCourse({ title: "Online only", price: 500 });
        await setMode(online.id, "ONLINE");
        await assignMentor(online.id, mentor.id);
        const milestone = await createMilestone(online.id);

        const res = await addModule(milestone, { mode: "OFFLINE" });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/both online and offline/);
        expect((await addModule(milestone, { mode: null })).status).toBe(201);
        expect((await addItem(await addWeek(online.id), { mode: "ONLINE" })).status).toBe(400);
    });
});
