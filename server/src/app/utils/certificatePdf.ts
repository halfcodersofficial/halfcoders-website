import PDFDocument from "pdfkit";
import { envVars } from "../config/env";

export interface CertificatePdfData {
    certificateNo: string;
    studentName: string;
    courseName: string;
    completionDate: Date;
    issuedAt: Date;
    /** The course's own terminology, e.g. "Week" instead of "Milestone". */
    milestoneLabel: string;
    moduleLabel: string;
    /** Which design to draw — see `Certificate.layout`. */
    layout: number;
    trainingDuration: string | null;
    assessed: boolean;
}

// A4 landscape, in points.
const WIDTH = 841.89;
const HEIGHT = 595.28;

const BRAND = "Half Coders";
const TAGLINE = "LEARN. BUILD. GROW TOGETHER.";

const INK = "#0f172a";
const MUTED = "#64748b";
const PRIMARY = "#6022cf";
const ACCENT = "#d9a441";
const RULE = "#e2e8f0";

const formatDate = (date: Date) =>
    date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/*
 * The built-in Helvetica only has Latin characters. A duration typed in Bangla
 * ("৬ মাস") would print as gibberish, so such a line is left off instead.
 */
const WIN_ANSI_EXTRAS = new Set([0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2026]);
const isLatinOnly = (text: string) =>
    [...text].every((char) => {
        const code = char.codePointAt(0) ?? 0;
        return (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRAS.has(code);
    });

type Doc = InstanceType<typeof PDFDocument>;

/** Layout 1, the original: "This is to certify that", the name, the course. */
const drawOriginal = (doc: Doc, data: CertificatePdfData) => {
    // Border
    doc.rect(0, 0, WIDTH, HEIGHT).fill("#ffffff");
    doc.lineWidth(6).strokeColor(PRIMARY).rect(18, 18, WIDTH - 36, HEIGHT - 36).stroke();
    doc.lineWidth(1).strokeColor(ACCENT).rect(32, 32, WIDTH - 64, HEIGHT - 64).stroke();

    // Header
    doc.fillColor(PRIMARY)
        .font("Helvetica-Bold")
        .fontSize(26)
        .text(BRAND, 0, 66, { align: "center", width: WIDTH });

    doc.fillColor(MUTED)
        .font("Helvetica")
        .fontSize(9)
        .text(TAGLINE, 0, 96, {
            align: "center",
            width: WIDTH,
            characterSpacing: 2,
        });

    doc.fillColor(INK)
        .font("Helvetica-Bold")
        .fontSize(30)
        .text("Certificate of Completion", 0, 132, { align: "center", width: WIDTH });

    doc.moveTo(WIDTH / 2 - 70, 174).lineTo(WIDTH / 2 + 70, 174).lineWidth(2)
        .strokeColor(ACCENT).stroke();

    // Recipient
    doc.fillColor(MUTED).font("Helvetica").fontSize(12)
        .text("This is to certify that", 0, 200, { align: "center", width: WIDTH });

    doc.fillColor(INK).font("Helvetica-Bold").fontSize(34)
        .text(data.studentName, 60, 224, { align: "center", width: WIDTH - 120 });

    doc.fillColor(MUTED).font("Helvetica").fontSize(12)
        .text("has successfully completed the course", 0, 276, { align: "center", width: WIDTH });

    doc.fillColor(PRIMARY).font("Helvetica-Bold").fontSize(21)
        .text(data.courseName, 60, 300, { align: "center", width: WIDTH - 120 });

    doc.fillColor(MUTED).font("Helvetica").fontSize(11)
        .text(`Completed on ${formatDate(data.completionDate)}`, 0, 344, {
            align: "center",
            width: WIDTH,
        });

    // Footer: id left, verification right.
    const footerY = HEIGHT - 132;

    doc.fillColor(MUTED).font("Helvetica").fontSize(8)
        .text("CERTIFICATE ID", 70, footerY, { characterSpacing: 1 });
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(13)
        .text(data.certificateNo, 70, footerY + 14);
    doc.fillColor(MUTED).font("Helvetica").fontSize(8)
        .text(`Issued ${formatDate(data.issuedAt)}`, 70, footerY + 34);

    const verifyUrl = `${envVars.FRONTEND_URL}/certificate/${data.certificateNo}`;
    const rightX = WIDTH / 2;
    const rightWidth = WIDTH / 2 - 70;

    doc.fillColor(MUTED).font("Helvetica").fontSize(8)
        .text("VERIFY THIS CERTIFICATE", rightX, footerY, {
            align: "right",
            width: rightWidth,
            characterSpacing: 1,
        });

    // Anyone holding the PDF can confirm it without contacting us (plan §29).
    doc.fillColor(PRIMARY).font("Helvetica").fontSize(9)
        .text(verifyUrl, rightX, footerY + 14, {
            align: "right",
            width: rightWidth,
            link: verifyUrl,
            underline: true,
        });

    doc.moveTo(70, HEIGHT - 78).lineTo(WIDTH - 70, HEIGHT - 78)
        .lineWidth(0.5).strokeColor(RULE).stroke();

    doc.fillColor(MUTED).font("Helvetica").fontSize(8)
        .text(
            `This certificate confirms completion of every ${data.moduleLabel.toLowerCase()}, ` +
                `assignment and ${data.milestoneLabel.toLowerCase()} required by the course.`,
            70,
            HEIGHT - 66,
            { align: "center", width: WIDTH - 140 },
        );
};

/**
 * Layout 2 (October 2026): Half Coders and its line under it, the title,
 * then the facts as labelled rows — course, participant, ID, completion date,
 * training duration, assessment — and the authorised signatory at the foot,
 * with the link that verifies it.
 */
const drawLayoutTwo = (doc: Doc, data: CertificatePdfData) => {
    doc.rect(0, 0, WIDTH, HEIGHT).fill("#ffffff");
    doc.lineWidth(6).strokeColor(PRIMARY).rect(18, 18, WIDTH - 36, HEIGHT - 36).stroke();
    doc.lineWidth(1).strokeColor(ACCENT).rect(32, 32, WIDTH - 64, HEIGHT - 64).stroke();

    doc.fillColor(PRIMARY).font("Helvetica-Bold").fontSize(26)
        .text(BRAND, 0, 62, { align: "center", width: WIDTH });

    doc.fillColor(MUTED).font("Helvetica").fontSize(9)
        .text(TAGLINE, 0, 94, {
            align: "center",
            width: WIDTH,
            characterSpacing: 2,
        });

    doc.fillColor(INK).font("Helvetica-Bold").fontSize(30)
        .text("Certificate of Completion", 0, 124, { align: "center", width: WIDTH });

    doc.moveTo(WIDTH / 2 - 70, 166).lineTo(WIDTH / 2 + 70, 166).lineWidth(2)
        .strokeColor(ACCENT).stroke();

    // The facts, a label and its value to a row, centred as a block.
    const labelX = 200;
    const valueX = 360;
    const valueWidth = WIDTH - 200 - valueX;
    const rows: { label: string; value: string; size: number; color: string }[] = [
        { label: "Course Name", value: data.courseName, size: 14, color: PRIMARY },
        { label: "Participant Name", value: data.studentName, size: 16, color: INK },
        { label: "Certificate ID", value: data.certificateNo, size: 12, color: INK },
        { label: "Completion Date", value: formatDate(data.completionDate), size: 12, color: INK },
        ...(data.trainingDuration && isLatinOnly(data.trainingDuration)
            ? [{ label: "Training Duration", value: data.trainingDuration, size: 12, color: INK }]
            : []),
        { label: "Assessment", value: data.assessed ? "Passed" : "Completed", size: 12, color: INK },
    ];

    let y = 194;
    for (const row of rows) {
        doc.font("Helvetica-Bold").fontSize(row.size);
        const valueHeight = doc.heightOfString(row.value, { width: valueWidth });
        doc.fillColor(MUTED).font("Helvetica").fontSize(10)
            .text(row.label, labelX, y + (row.size - 10) / 2 + 1, { width: valueX - labelX - 16 });
        doc.fillColor(row.color).font("Helvetica-Bold").fontSize(row.size)
            .text(row.value, valueX, y, { width: valueWidth });
        y += valueHeight + 11;
        doc.moveTo(labelX, y).lineTo(valueX + valueWidth, y).lineWidth(0.5).strokeColor(RULE).stroke();
        y += 11;
    }

    // Foot: how to verify it on the left, the signatory on the right.
    const footY = HEIGHT - 128;
    const verifyUrl = `${envVars.FRONTEND_URL}/certificate/${data.certificateNo}`;

    doc.fillColor(MUTED).font("Helvetica").fontSize(8)
        .text("VERIFY THIS CERTIFICATE", 70, footY + 40, { characterSpacing: 1 });
    // Anyone holding the PDF can confirm it without contacting us (plan §29).
    doc.fillColor(PRIMARY).font("Helvetica").fontSize(9)
        .text(verifyUrl, 70, footY + 54, { width: WIDTH / 2 - 70, link: verifyUrl, underline: true });

    const signX = WIDTH - 70 - 200;
    const signWidth = 200;
    doc.moveTo(signX, footY + 34).lineTo(signX + signWidth, footY + 34)
        .lineWidth(0.75).strokeColor(INK).stroke();
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(10)
        .text("Authorized Signatory", signX, footY + 42, { align: "center", width: signWidth });
    doc.fillColor(MUTED).font("Helvetica").fontSize(9)
        .text("Founder & CEO", signX, footY + 57, { align: "center", width: signWidth })
        .text(BRAND, signX, footY + 70, { align: "center", width: signWidth });
};

/**
 * Renders a certificate as a PDF and streams it back.
 *
 * Generated on demand rather than written to storage: it costs nothing to
 * keep, can never go stale against a renamed course, and — because the caller
 * checks status first — a revoked certificate simply stops being downloadable
 * instead of leaving a valid-looking file in a bucket forever.
 *
 * Returns a Buffer so the caller controls the response headers and can decide
 * between inline preview and attachment download.
 */
export const buildCertificatePdf = (data: CertificatePdfData): Promise<Buffer> =>
    new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: [WIDTH, HEIGHT],
            margin: 0,
            info: {
                Title: `${BRAND} Certificate ${data.certificateNo}`,
                Author: BRAND,
                Subject: `Certificate of completion for ${data.courseName}`,
            },
        });

        const chunks: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        if (data.layout >= 2) drawLayoutTwo(doc, data);
        else drawOriginal(doc, data);

        doc.end();
    });
