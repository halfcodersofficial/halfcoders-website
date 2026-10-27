import { beforeAll, describe, expect, it } from "vitest";
import { cloudinaryUpload } from "../../src/app/config/cloudinary.config";
import { api, createAccount, type TestAccount } from "../helpers/fixtures";

const PUBLIC_ID = "halfcoders/pdfs/abc-1792942475586-roadmap";
const stored = () =>
    cloudinaryUpload.url(PUBLIC_ID, { type: "authenticated", sign_url: true, resource_type: "image", format: "pdf" });

/**
 * Private files (the curriculum PDF, hand-in files) are stored as signed
 * Cloudinary links that Cloudinary won't serve a PDF from, so they open
 * through the API: it checks the link is ours and forwards to a short-lived
 * download.
 */
describe("opening a private file", () => {
    let student: TestAccount;

    beforeAll(async () => {
        student = await createAccount("STUDENT");
    });

    const open = (url: string, account: TestAccount | null = student) => {
        const request = api().get("/api/v1/files/private").query({ url });
        return account ? request.set("Cookie", account.cookie) : request;
    };

    it("forwards a genuine link to a download that expires", async () => {
        const res = await open(stored());
        expect(res.status).toBe(302);
        expect(res.headers["cache-control"]).toBe("no-store");

        const location = new URL(res.headers.location);
        expect(location.origin).toBe("https://api.cloudinary.com");
        expect(location.pathname).toBe("/v1_1/test/image/download");
        expect(location.searchParams.get("public_id")).toBe(PUBLIC_ID);
        expect(location.searchParams.get("type")).toBe("authenticated");
        expect(location.searchParams.get("signature")).toBeTruthy();
        expect(Number(location.searchParams.get("expires_at"))).toBeGreaterThan(Date.now() / 1000);
    });

    it("needs a signed-in account", async () => {
        const res = await open(stored(), null);
        expect(res.status).toBe(401);
    });

    it("refuses a link whose signature doesn't check out", async () => {
        const res = await open(stored().replace(/s--[^/]+--/, "s--AAAAAAAA--"));
        expect(res.status).toBe(404);
    });

    it("refuses anything that isn't one of our private files", async () => {
        for (const url of [
            stored().replace("/authenticated/", "/upload/"),
            cloudinaryUpload.url("portal/pdfs/cv", { type: "authenticated", sign_url: true, resource_type: "image", format: "pdf" }),
            "https://example.com/roadmap.pdf",
            "not a link",
        ]) {
            const res = await open(url);
            expect(res.status, url).toBe(404);
        }
    });
});
