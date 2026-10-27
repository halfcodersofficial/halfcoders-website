import PDFDocument from "pdfkit";
import { envVars } from "../config/env";
import { drawMixedText, registerPdfFonts } from "./pdfText";

export interface InvoicePdfData {
    orderNumber: string;
    issuedAt: Date;
    studentName: string;
    studentEmail: string;
    studentPhone: string | null;
    courseName: string;
    amount: number;
    discount: number;
    /** The coupon the discount came with, if any — named on the discount line. */
    couponCode?: string | null;
    total: number;
    currency: string;
    gateway: string;
    transactionId: string | null;
    paidAt: Date | null;
}

// A4 portrait, in points.
const WIDTH = 595.28;
const HEIGHT = 841.89;
const MARGIN = 56;

const INK = "#0f172a";
const MUTED = "#64748b";
const PRIMARY = "#6022cf";
const BORDER = "#e2e8f0";
const SOFT = "#f8fafc";
const SUCCESS = "#16a34a";

const formatDate = (date: Date) =>
    date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const money = (amount: number, currency: string) =>
    currency === "BDT" ? `৳${amount.toLocaleString("en-BD")}` : `${currency} ${amount.toLocaleString("en-BD")}`;

/**
 * Renders an order's invoice as a PDF and streams it back — generated on
 * demand (never stored) for the same reason `buildCertificatePdf` isn't:
 * it costs nothing to keep and can never go stale against a renamed course.
 * Reused both by the student-facing download endpoint and the
 * payment-confirmation email attachment.
 */
export const buildInvoicePdf = (data: InvoicePdfData): Promise<Buffer> =>
    new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: [WIDTH, HEIGHT],
            margin: 0,
            info: {
                Title: `Half Coders Invoice ${data.orderNumber}`,
                Author: "Half Coders",
                Subject: `Invoice for ${data.courseName}`,
            },
        });

        const chunks: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        registerPdfFonts(doc);

        const rightColX = WIDTH / 2;
        const rightColWidth = WIDTH - MARGIN - rightColX;
        const contentWidth = WIDTH - MARGIN * 2;
        // The amount column, inset like the table's header row.
        const amountWidth = WIDTH - MARGIN - 12 - rightColX;
        const amount = (text: string, y: number, size: number, color: string, bold = false) =>
            drawMixedText(doc, text, rightColX, y, { size, color, bold, align: "right", width: amountWidth });

        doc.rect(0, 0, WIDTH, HEIGHT).fill("#ffffff");

        // Header: brand left, "INVOICE" + order number right.
        doc.fillColor(PRIMARY).font("Helvetica-Bold").fontSize(22).text("Half Coders", MARGIN, 56);
        doc.fillColor(MUTED).font("Helvetica").fontSize(8)
            .text("LEARN. BUILD. GROW TOGETHER.", MARGIN, 82, { characterSpacing: 1.5 });

        doc.fillColor(INK).font("Helvetica-Bold").fontSize(20)
            .text("INVOICE", rightColX, 56, { align: "right", width: rightColWidth });
        drawMixedText(doc, data.orderNumber, rightColX, 80, { size: 10, color: MUTED, align: "right", width: rightColWidth });

        doc.moveTo(MARGIN, 116).lineTo(WIDTH - MARGIN, 116).lineWidth(1).strokeColor(BORDER).stroke();

        // Billed to / invoice meta
        doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(9)
            .text("BILLED TO", MARGIN, 140, { characterSpacing: 1 });
        const billedWidth = rightColX - MARGIN - 16;
        drawMixedText(doc, data.studentName, MARGIN, 156, { size: 12, color: INK, bold: true, width: billedWidth });
        drawMixedText(doc, data.studentEmail, MARGIN, 174, { size: 10, color: MUTED, width: billedWidth });
        if (data.studentPhone) {
            drawMixedText(doc, data.studentPhone, MARGIN, 190, { size: 10, color: MUTED, width: billedWidth });
        }

        doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(9)
            .text("INVOICE DATE", rightColX, 140, { align: "right", width: rightColWidth, characterSpacing: 1 });
        doc.fillColor(INK).font("Helvetica").fontSize(10)
            .text(formatDate(data.issuedAt), rightColX, 156, { align: "right", width: rightColWidth });

        doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(9)
            .text("STATUS", rightColX, 180, { align: "right", width: rightColWidth, characterSpacing: 1 });
        doc.fillColor(SUCCESS).font("Helvetica-Bold").fontSize(11)
            .text("PAID", rightColX, 196, { align: "right", width: rightColWidth });

        // Line item table
        const tableTop = 240;
        doc.rect(MARGIN, tableTop, contentWidth, 28).fill(SOFT);
        doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(9)
            .text("DESCRIPTION", MARGIN + 12, tableTop + 9, { characterSpacing: 0.5 });
        doc.text("AMOUNT", rightColX, tableTop + 9, {
            align: "right",
            width: WIDTH - MARGIN - 12 - rightColX,
            characterSpacing: 0.5,
        });

        let y = tableTop + 28 + 16;
        // A long title wraps; the rows below move down with it.
        const titleHeight = drawMixedText(doc, data.courseName, MARGIN + 12, y, {
            size: 11,
            color: INK,
            bold: true,
            width: contentWidth - 160,
        });
        doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("Course access", MARGIN + 12, y + titleHeight + 2);
        amount(money(data.amount, data.currency), y, 11, INK);

        y += Math.max(48, titleHeight + 34);
        doc.moveTo(MARGIN, y).lineTo(WIDTH - MARGIN, y).lineWidth(1).strokeColor(BORDER).stroke();
        y += 16;

        if (data.discount > 0) {
            doc.font("Helvetica").fontSize(10).fillColor(MUTED).text("Subtotal", MARGIN + 12, y);
            amount(money(data.amount, data.currency), y, 10, MUTED);
            y += 20;
            doc.font("Helvetica").fontSize(10).fillColor(SUCCESS).text(data.couponCode ? `Discount (code ${data.couponCode})` : "Discount", MARGIN + 12, y);
            amount(`−${money(data.discount, data.currency)}`, y, 10, SUCCESS);
            y += 24;
            doc.moveTo(MARGIN, y).lineTo(WIDTH - MARGIN, y).lineWidth(1).strokeColor(BORDER).stroke();
            y += 16;
        }

        doc.font("Helvetica-Bold").fontSize(13).fillColor(INK).text("Total paid", MARGIN + 12, y);
        amount(money(data.total, data.currency), y, 13, INK, true);

        y += 44;
        doc.moveTo(MARGIN, y).lineTo(WIDTH - MARGIN, y).lineWidth(1).strokeColor(BORDER).stroke();
        y += 20;

        doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(9)
            .text("PAYMENT METHOD", MARGIN, y, { characterSpacing: 1 });
        drawMixedText(doc, data.gateway, MARGIN, y + 16, { size: 10, color: INK, width: rightColX - MARGIN - 16 });

        if (data.transactionId) {
            doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(9)
                .text("TRANSACTION ID", rightColX, y, { align: "right", width: rightColWidth, characterSpacing: 1 });
            drawMixedText(doc, data.transactionId, rightColX, y + 16, {
                size: 10,
                color: INK,
                align: "right",
                width: rightColWidth,
            });
        }

        if (data.paidAt) {
            y += 40;
            doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(`Paid on ${formatDate(data.paidAt)}`, MARGIN, y);
        }

        // Footer
        doc.fillColor(MUTED).font("Helvetica").fontSize(8)
            .text("This is a computer-generated invoice and does not require a signature.", MARGIN, HEIGHT - 60, {
                align: "center",
                width: contentWidth,
            });
        doc.fillColor(PRIMARY).font("Helvetica").fontSize(8)
            .text(envVars.FRONTEND_URL, MARGIN, HEIGHT - 46, {
                align: "center",
                width: contentWidth,
                link: envVars.FRONTEND_URL,
                underline: true,
            });

        doc.end();
    });
