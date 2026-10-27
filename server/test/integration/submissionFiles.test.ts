import { beforeAll, describe, expect, it, vi } from "vitest";
import { api, createAccount, type TestAccount } from "../helpers/fixtures";
import { assignMentor, createAssignment, createCourse, createMilestone, enrol } from "../helpers/learning";

// Cloudinary is outside the test: a private upload "succeeds" with a link shaped like the real one.
vi.mock("../../src/app/config/cloudinary.config", async (importOriginal) => {
    const original = await importOriginal<typeof import("../../src/app/config/cloudinary.config")>();
    return {
        ...original,
        uploadPrivateFileToCloudinary: vi.fn(async (_buffer: Buffer, fileName: string, folder = "pdfs") => ({
            url: `https://res.cloudinary.com/test/image/authenticated/s--sig--/v1/halfcoders/${folder}/abc-${Date.now()}-${fileName}`,
            publicId: `halfcoders/${folder}/${fileName}`,
        })),
    };
});

const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

/**
 * Students attach files to a hand-in: PDFs and images, checked by content and
 * size, stored privately — and only files uploaded this way may be attached.
 */
describe("assignment hand-in files", () => {
    let student: TestAccount;
    let outsider: TestAccount;
    let mentor: TestAccount;
    let assignmentId: string;

    beforeAll(async () => {
        [student, outsider, mentor] = await Promise.all([createAccount("STUDENT"), createAccount("STUDENT"), createAccount("MENTOR")]);
        const course = await createCourse();
        const milestone = await createMilestone(course.id);
        assignmentId = await createAssignment(course.id, milestone);
        await enrol(student.id, course.id);
        await assignMentor(course.id, mentor.id);
    });

    const upload = (account: TestAccount) => api().post(`/api/v1/assignments/${assignmentId}/files`).set("Cookie", account.cookie);

    it("stores a PDF and an image privately and hands back their links and names", async () => {
        const res = await upload(student)
            .attach("files", PDF, { filename: "Report final.pdf", contentType: "application/pdf" })
            .attach("files", PNG, { filename: "screen.png", contentType: "image/png" });
        expect(res.status).toBe(201);
        expect(res.body.data).toHaveLength(2);
        expect(res.body.data[0]).toMatchObject({ name: "Report final.pdf" });
        expect(res.body.data[0].url).toMatch(/\/halfcoders\/submissions\//);
    });

    it("refuses a student who isn't on the course", async () => {
        const res = await upload(outsider).attach("files", PDF, { filename: "a.pdf", contentType: "application/pdf" });
        expect(res.status).toBe(403);
    });

    it("refuses staff — it's the student's own work", async () => {
        const res = await upload(mentor).attach("files", PDF, { filename: "a.pdf", contentType: "application/pdf" });
        expect(res.status).toBe(403);
    });

    it("says why a file type isn't allowed (not a masked 500)", async () => {
        const res = await upload(student).attach("files", Buffer.from("hello"), { filename: "notes.txt", contentType: "text/plain" });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/isn't a JPEG, PNG, WebP or PDF/);
    });

    it("rejects a file whose contents don't match its claimed type", async () => {
        const res = await upload(student).attach("files", Buffer.from("<svg onload=alert(1)>"), { filename: "x.png", contentType: "image/png" });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/contents do not match/);
    });

    it("says when a file is over 5 MB", async () => {
        const big = Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024 + 10, 0x20)]);
        const res = await upload(student).attach("files", big, { filename: "big.pdf", contentType: "application/pdf" });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe("Each file must be 5 MB or smaller.");
    });

    it("says when there are too many files", async () => {
        let req = upload(student);
        for (let i = 0; i < 6; i++) req = req.attach("files", PDF, { filename: `${i}.pdf`, contentType: "application/pdf" });
        const res = await req;
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/too many files/);
    });

    it("only accepts files from the upload on a hand-in, and the mentor sees them", async () => {
        const foreign = await api()
            .post(`/api/v1/assignments/${assignmentId}/submit`)
            .set("Cookie", student.cookie)
            .send({ content: "My work", fileUrls: ["https://evil.example/malware.pdf"] });
        expect(foreign.status).toBe(400);
        expect(foreign.body.message).toMatch(/upload button/);

        const uploaded = await upload(student).attach("files", PDF, { filename: "work.pdf", contentType: "application/pdf" });
        const url = uploaded.body.data[0].url;
        const submitted = await api()
            .post(`/api/v1/assignments/${assignmentId}/submit`)
            .set("Cookie", student.cookie)
            .send({ content: "My work", fileUrls: [url] });
        expect(submitted.status).toBe(201);

        const queue = await api().get("/api/v1/assignments/submissions/queue").set("Cookie", mentor.cookie);
        expect(queue.body.data[0].fileUrls).toEqual([url]);
    });

    it("replaces the whole attempt on a resubmission — nothing old is left behind", async () => {
        const queue = await api().get("/api/v1/assignments/submissions/queue").set("Cookie", mentor.cookie);
        const submissionId = queue.body.data[0].id;
        await api()
            .patch(`/api/v1/assignments/submissions/${submissionId}/review`)
            .set("Cookie", mentor.cookie)
            .send({ status: "NEEDS_REVISION", feedback: "Add a README." });

        const uploaded = await upload(student).attach("files", PDF, { filename: "v2.pdf", contentType: "application/pdf" });
        const again = await api()
            .post(`/api/v1/assignments/${assignmentId}/submit`)
            .set("Cookie", student.cookie)
            .send({ fileUrls: [uploaded.body.data[0].url] });
        expect(again.status).toBe(201);

        const mine = await api().get(`/api/v1/assignments/${assignmentId}`).set("Cookie", student.cookie);
        expect(mine.body.data.submission.content).toBeNull();
        expect(mine.body.data.submission.fileUrls).toEqual([uploaded.body.data[0].url]);
    });
});
