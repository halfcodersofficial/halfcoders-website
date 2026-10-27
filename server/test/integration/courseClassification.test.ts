import { beforeAll, describe, expect, it } from "vitest";
import { api, createAccount, owner, type TestAccount } from "../helpers/fixtures";
import { assignMentor, createCourse, createMilestone, enrol, notificationsOf } from "../helpers/learning";

const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

const courseRow = async (id: string) => (await owner.query(`SELECT * FROM learning.course WHERE id = $1`, [id])).rows[0];

/**
 * The three classifications every course carries — present, upcoming or
 * previous; free or paid; live, recorded or both — and what the phase rules
 * out on the server, whatever the consoles show.
 */
describe("course classification", () => {
    let admin: TestAccount;
    let mentor: TestAccount;
    let student: TestAccount;

    beforeAll(async () => {
        [admin, mentor, student] = await Promise.all([createAccount("ADMIN"), createAccount("MENTOR"), createAccount("STUDENT")]);
    });

    const create = (body: object) => api().post("/api/v1/courses/manage").set("Cookie", admin.cookie).send(body);
    const update = (courseId: string, body: object) =>
        api().patch(`/api/v1/courses/manage/${courseId}`).set("Cookie", admin.cookie).send(body);
    const basics = { title: "Classified course", description: "A course with all three classifications set." };

    describe("creating", () => {
        it("insists on all three classifications", async () => {
            const none = await create({ ...basics, price: 500 });
            expect(none.status).toBe(400);
            expect(none.body.message).toMatch(/course status/);
            const noDelivery = await create({ ...basics, price: 500, phase: "PRESENT", pricing: "PAID" });
            expect(noDelivery.status).toBe(400);
            expect(noDelivery.body.message).toMatch(/classes are delivered/);
        });

        it("stores a free course at ৳0, whatever price it was sent", async () => {
            const res = await create({ ...basics, phase: "PRESENT", pricing: "FREE", delivery: "RECORDED", mode: "ONLINE", price: 900, discountPrice: 100 });
            expect(res.status).toBe(201);
            expect(res.body.data).toMatchObject({ phase: "PRESENT", pricing: "FREE", delivery: "RECORDED", price: 0, discountPrice: null });
        });

        it("refuses a paid course without a price, or discounted to nothing", async () => {
            expect((await create({ ...basics, phase: "PRESENT", pricing: "PAID", delivery: "LIVE" })).status).toBe(400);
            expect((await create({ ...basics, phase: "PRESENT", pricing: "PAID", delivery: "LIVE", price: 0 })).status).toBe(400);
            expect((await create({ ...basics, phase: "PRESENT", pricing: "PAID", delivery: "LIVE", price: 500, discountPrice: 0 })).status).toBe(400);
            const ok = await create({ ...basics, phase: "UPCOMING", pricing: "PAID", delivery: "HYBRID", mode: "ONLINE", price: 500, discountPrice: 400 });
            expect(ok.status).toBe(201);
            expect(ok.body.data).toMatchObject({ phase: "UPCOMING", pricing: "PAID", price: 500, discountPrice: 400 });
        });

        it("checks paid prices against the stored record on an edit", async () => {
            const { id } = await createCourse({ price: 800 });
            expect((await update(id, { price: 0 })).status).toBe(400);
            const free = await update(id, { pricing: "FREE" });
            expect(free.status).toBe(200);
            expect(await courseRow(id)).toMatchObject({ pricing: "FREE", price: 0, discountPrice: null });
            expect((await update(id, { pricing: "PAID" })).status).toBe(400);
            expect((await update(id, { pricing: "PAID", price: 1200 })).status).toBe(200);
        });
    });

    describe("an upcoming course", () => {
        let course: { id: string; slug: string };

        beforeAll(async () => {
            course = await createCourse({ phase: "UPCOMING", courseType: "TRADITIONAL", status: "DRAFT" });
            await assignMentor(course.id, mentor.id);
        });

        it("has no Module Manager, for admins or mentors", async () => {
            for (const account of [admin, mentor]) {
                const res = await api().post("/api/v1/milestones").set("Cookie", account.cookie).send({ courseId: course.id, title: "Week one" });
                expect(res.status).toBe(400);
                expect(res.body.message).toMatch(/upcoming/i);
            }
        });

        it("has no running outline", async () => {
            const week = await api().post("/api/v1/outline/weeks").set("Cookie", mentor.cookie).send({ courseId: course.id });
            expect(week.status).toBe(400);
            const copy = await api().post(`/api/v1/outline/course/${course.id}/copy-from-modules`).set("Cookie", admin.cookie);
            expect(copy.status).toBe(400);
        });

        it("still publishes on its curriculum PDF alone, with no milestones", async () => {
            await owner.query(`UPDATE learning.course SET "curriculumPdfUrl" = 'https://example.test/roadmap.pdf' WHERE id = $1`, [course.id]);
            const res = await api().patch(`/api/v1/courses/manage/${course.id}/status`).set("Cookie", admin.cookie).send({ status: "PUBLISHED" });
            expect(res.status).toBe(200);
        });

        it("opens up once it's moved to present", async () => {
            expect((await update(course.id, { phase: "PRESENT" })).status).toBe(200);
            const res = await api().post("/api/v1/milestones").set("Cookie", mentor.cookie).send({ courseId: course.id, title: "Week one" });
            expect(res.status).toBe(201);
        });

        it("can't be moved back to upcoming once it has modules", async () => {
            const res = await update(course.id, { phase: "UPCOMING" });
            expect(res.status).toBe(409);
            expect((await courseRow(course.id)).phase).toBe("PRESENT");
        });

        it("can be moved back while it's still empty", async () => {
            const empty = await createCourse();
            expect((await update(empty.id, { phase: "UPCOMING" })).status).toBe(200);
        });
    });

    describe("moving a course to previous", () => {
        let course: { id: string; slug: string };
        let upcomingSession: string;
        let pastSession: string;

        beforeAll(async () => {
            course = await createCourse({ title: "Finished bootcamp", price: 3000 });
            await createMilestone(course.id);
            await assignMentor(course.id, mentor.id);
            await enrol(student.id, course.id);
            await owner.query(
                `UPDATE learning.course SET "supportInfo" = 'Weekly support on Fridays.',
                     "startsAt" = (now() AT TIME ZONE 'UTC') - interval '60 days', "endsAt" = (now() AT TIME ZONE 'UTC') + interval '1 day',
                     "nextStartsAt" = (now() AT TIME ZONE 'UTC') + interval '30 days'
                 WHERE id = $1`,
                [course.id],
            );
            const scheduled = await api().post("/api/v1/support/manage").set("Cookie", mentor.cookie)
                .send({ courseId: course.id, startTime: inMinutes(24 * 60), endTime: inMinutes(25 * 60) });
            expect(scheduled.status).toBe(201);
            upcomingSession = scheduled.body.data.id;
            pastSession = (await owner.query(
                `INSERT INTO learning.support_session (id, "courseId", "mentorId", "startTime", "endTime", status, "updatedAt")
                 VALUES (gen_random_uuid(), $1, $2, (now() AT TIME ZONE 'UTC') - interval '3 days', (now() AT TIME ZONE 'UTC') - interval '71 hours', 'ENDED', now())
                 RETURNING id`,
                [course.id, mentor.id],
            )).rows[0].id;
        });

        it("is allowed, modules and all, and closes what a previous course doesn't have", async () => {
            const res = await update(course.id, { phase: "PREVIOUS", supportInfo: "Still here?" });
            expect(res.status).toBe(200);

            const row = await courseRow(course.id);
            expect(row).toMatchObject({ phase: "PREVIOUS", supportInfo: null, startsAt: null, endsAt: null, nextStartsAt: null });

            const sessions = (await owner.query(`SELECT id, status FROM learning.support_session WHERE "courseId" = $1`, [course.id])).rows;
            expect(sessions.find((s: { id: string }) => s.id === upcomingSession).status).toBe("CANCELLED");
            // History stays as it was.
            expect(sessions.find((s: { id: string }) => s.id === pastSession).status).toBe("ENDED");

            const titles = (await notificationsOf(student.id)).map((n: { title: string }) => n.title);
            expect(titles.filter((title: string) => title === "Support sessions cancelled")).toHaveLength(1);
        });

        it("holds no new support sessions, and reopens none", async () => {
            const res = await api().post("/api/v1/support/manage").set("Cookie", admin.cookie)
                .send({ courseId: course.id, startTime: inMinutes(60), endTime: inMinutes(120) });
            expect(res.status).toBe(400);
            const reopen = await api().patch(`/api/v1/support/manage/${upcomingSession}/status`).set("Cookie", mentor.cookie).send({ status: "SCHEDULED" });
            expect(reopen.status).toBe(400);
            const moved = await api().patch(`/api/v1/support/manage/${upcomingSession}`).set("Cookie", mentor.cookie).send({ title: "Moved" });
            expect(moved.status).toBe(400);
        });

        it("shows students no sessions and lets no one queue", async () => {
            await owner.query(
                `UPDATE learning.support_session SET status = 'SCHEDULED', "startTime" = (now() AT TIME ZONE 'UTC') - interval '5 minutes', "endTime" = (now() AT TIME ZONE 'UTC') + interval '1 hour' WHERE id = $1`,
                [upcomingSession],
            );
            const list = await api().get(`/api/v1/support/course/${course.id}`).set("Cookie", student.cookie);
            expect(list.status).toBe(200);
            expect(list.body.data).toEqual([]);
            const join = await api().post(`/api/v1/support/${upcomingSession}/join`).set("Cookie", student.cookie).send({});
            expect(join.status).toBe(400);
        });

        it("keeps no batch dates, so it takes enrolments as a recorded course", async () => {
            await update(course.id, { startsAt: inMinutes(60 * 24 * 7) });
            expect((await courseRow(course.id)).startsAt).toBeNull();
        });
    });

    describe("the public catalogue", () => {
        let present: { id: string };
        let upcoming: { id: string };
        let previous: { id: string };

        beforeAll(async () => {
            present = await createCourse({ title: "Catalogue present" });
            upcoming = await createCourse({ title: "Catalogue upcoming", phase: "UPCOMING", price: 1500 });
            previous = await createCourse({ title: "Catalogue previous", phase: "PREVIOUS" });
        });

        const list = async (query: string) =>
            (await api().get(`/api/v1/courses?searchTerm=Catalogue&limit=48&${query}`)).body.data.map((c: { id: string }) => c.id) as string[];

        it("filters by phase, price and delivery", async () => {
            expect(await list("phase=UPCOMING")).toEqual([upcoming.id]);
            expect((await list("pricing=FREE")).sort()).toEqual([present.id, previous.id].sort());
            expect(await list("pricing=PAID")).toEqual([upcoming.id]);
            expect(await list("delivery=LIVE")).toEqual([]);
        });

        it("ignores a phase it doesn't know rather than failing", async () => {
            const res = await api().get("/api/v1/courses?searchTerm=Catalogue&phase=SOON");
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(3);
        });
    });
});
