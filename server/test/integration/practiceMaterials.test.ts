import { beforeAll, describe, expect, it } from "vitest";
import { api, createAccount, type TestAccount } from "../helpers/fixtures";
import { assignMentor, createCourse, createMilestone, enrol } from "../helpers/learning";

/**
 * A practice day's lessons: videos, texts and links, the same three a
 * module's lessons are — added, edited, reordered and deleted by the course's
 * staff, and read by students with the practice day, in order, once it's
 * published.
 */
describe("practice day lessons", () => {
    let mentor: TestAccount;
    let outsider: TestAccount;
    let student: TestAccount;
    let practiceDayId: string;

    beforeAll(async () => {
        [mentor, outsider, student] = await Promise.all([createAccount("MENTOR"), createAccount("MENTOR"), createAccount("STUDENT")]);
        const course = await createCourse({ courseType: "BOOTCAMP" });
        const milestoneId = await createMilestone(course.id);
        await assignMentor(course.id, mentor.id);
        await enrol(student.id, course.id);

        const created = await api()
            .post("/api/v1/practice-days/manage")
            .set("Cookie", mentor.cookie)
            .send({ milestoneId, title: "Loops practice", instructions: "Print a triangle." });
        expect(created.status).toBe(201);
        practiceDayId = created.body.data.id;
    });

    const add = (account: TestAccount, body: object) =>
        api().post("/api/v1/practice-materials").set("Cookie", account.cookie).send({ practiceDayId, ...body });
    const list = () => api().get(`/api/v1/practice-materials/practice-day/${practiceDayId}`).set("Cookie", mentor.cookie);
    const studentView = () => api().get(`/api/v1/practice-days/${practiceDayId}`).set("Cookie", student.cookie);

    it("adds a video, a text and a link, each needing its own field", async () => {
        expect((await add(mentor, { type: "VIDEO", title: "Loops in C" })).status).toBe(400);
        expect((await add(mentor, { type: "RESOURCE", title: "Cheat sheet", resourceUrl: "javascript:alert(1)" })).status).toBe(400);

        const video = await add(mentor, { type: "VIDEO", title: "Loops in C", youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
        expect(video.status).toBe(201);
        expect(video.body.data).toMatchObject({ type: "VIDEO", youtubeVideoId: "dQw4w9WgXcQ", order: 1 });
        expect((await add(mentor, { type: "TEXT", title: "Read first", content: "**Nested** loops." })).status).toBe(201);
        expect((await add(mentor, { type: "RESOURCE", title: "Cheat sheet", resourceUrl: "https://example.com/loops.pdf" })).status).toBe(201);

        const res = await list();
        expect(res.body.data.map((m: { title: string; order: number }) => [m.order, m.title])).toEqual([
            [1, "Loops in C"],
            [2, "Read first"],
            [3, "Cheat sheet"],
        ]);
    });

    it("keeps a lesson's type fixed", async () => {
        const text = (await list()).body.data.find((m: { type: string }) => m.type === "TEXT");
        const res = await api().patch(`/api/v1/practice-materials/${text.id}`).set("Cookie", mentor.cookie).send({ youtubeUrl: "https://youtu.be/dQw4w9WgXcQ" });
        expect(res.status).toBe(400);
        const ok = await api().patch(`/api/v1/practice-materials/${text.id}`).set("Cookie", mentor.cookie).send({ content: "Updated text." });
        expect(ok.status).toBe(200);
        expect(ok.body.data.content).toBe("Updated text.");
    });

    it("refuses staff who don't manage the course", async () => {
        expect((await add(outsider, { type: "TEXT", title: "Sneaky", content: "Hi" })).status).toBe(403);
        expect((await api().get(`/api/v1/practice-materials/practice-day/${practiceDayId}`).set("Cookie", outsider.cookie)).status).toBe(403);
    });

    it("reorders them, and closes the gap when one is deleted", async () => {
        const ids = (await list()).body.data.map((m: { id: string }) => m.id) as string[];
        const reordered = await api()
            .patch(`/api/v1/practice-materials/practice-day/${practiceDayId}/reorder`)
            .set("Cookie", mentor.cookie)
            .send({ orderedIds: [ids[2], ids[0], ids[1]] });
        expect(reordered.status).toBe(200);

        expect((await api().delete(`/api/v1/practice-materials/${ids[0]}`).set("Cookie", mentor.cookie)).status).toBe(200);
        const after = (await list()).body.data.map((m: { id: string; order: number }) => [m.order, m.id]);
        expect(after).toEqual([
            [1, ids[2]],
            [2, ids[1]],
        ]);
    });

    it("shows students the lessons, in order, once the practice day is published", async () => {
        expect((await studentView()).status).toBe(404);
        const published = await api().patch(`/api/v1/practice-days/manage/${practiceDayId}`).set("Cookie", mentor.cookie).send({ isPublished: true });
        expect(published.status).toBe(200);

        const res = await studentView();
        expect(res.status).toBe(200);
        expect(res.body.data.materials.map((m: { title: string }) => m.title)).toEqual(["Cheat sheet", "Read first"]);
    });
});
