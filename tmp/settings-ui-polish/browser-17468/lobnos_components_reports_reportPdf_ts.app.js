"use strict";
(self["webpackChunkPrimeLabSystem_PLS_"] = self["webpackChunkPrimeLabSystem_PLS_"] || []).push([["lobnos_components_reports_reportPdf_ts"],{

/***/ "../lobnos/components/invoices/organizationInvoicePdf.ts":
/*!***************************************************************!*\
  !*** ../lobnos/components/invoices/organizationInvoicePdf.ts ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ACCENT: () => (/* binding */ ACCENT),
/* harmony export */   CURRENCY: () => (/* binding */ CURRENCY),
/* harmony export */   INK: () => (/* binding */ INK),
/* harmony export */   LIGHT: () => (/* binding */ LIGHT),
/* harmony export */   MUTED: () => (/* binding */ MUTED),
/* harmony export */   STATUS_LABELS: () => (/* binding */ STATUS_LABELS),
/* harmony export */   buildOrganizationInvoicePdf: () => (/* binding */ buildOrganizationInvoicePdf),
/* harmony export */   formatDate: () => (/* binding */ formatDate),
/* harmony export */   imageFormat: () => (/* binding */ imageFormat),
/* harmony export */   money: () => (/* binding */ money),
/* harmony export */   phone: () => (/* binding */ phone)
/* harmony export */ });
/* harmony import */ var jspdf__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! jspdf */ "../lobnos/node_modules/jspdf/dist/jspdf.es.min.js");
/* harmony import */ var jspdf_autotable__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! jspdf-autotable */ "../lobnos/node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.mjs");


const STATUS_LABELS = {
    unpaid: "Unpaid",
    partially_paid: "Partially Paid",
    paid: "Paid",
    void: "Void",
};
const CURRENCY = "GHS";
function money(value) {
    const num = Number(value ?? 0);
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(num) ? num : 0);
}
function formatDate(value) {
    if (!value)
        return "";
    const text = String(value);
    // DATE columns may arrive as "YYYY-MM-DD" or an ISO timestamp; never shift the calendar day.
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
    const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(text);
    if (Number.isNaN(date.getTime()))
        return text;
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}
function phone(value) {
    if (value === null || value === undefined || value === "")
        return "";
    const text = String(value).trim();
    // Legacy numeric phone columns drop the leading zero.
    return /^\d{9}$/.test(text) ? `0${text}` : text;
}
function imageFormat(dataUrl) {
    const match = /^data:image\/(png|jpe?g|webp)/i.exec(dataUrl);
    if (!match)
        return "PNG";
    return match[1].toLowerCase().startsWith("jp") ? "JPEG" : match[1].toUpperCase();
}
const INK = [33, 37, 41];
const MUTED = [108, 117, 125];
const ACCENT = [20, 61, 110];
const LIGHT = [236, 241, 247];
function buildOrganizationInvoicePdf(detail, logoDataUrl) {
    const { invoice, lines, payments } = detail;
    const company = detail.company || {};
    const org = detail.organization;
    const doc = new jspdf__WEBPACK_IMPORTED_MODULE_0__["default"]({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    doc.setProperties({ title: `Invoice ${invoice.invoice_number}`, subject: "Organizational credit invoice", creator: "Prime Laboratory Software" });
    // ── Letterhead ─────────────────────────────────────────────
    let y = margin;
    let textLeft = margin;
    if (logoDataUrl) {
        try {
            doc.addImage(logoDataUrl, imageFormat(logoDataUrl), margin, y, 22, 22);
            textLeft = margin + 26;
        }
        catch {
            textLeft = margin;
        }
    }
    doc.setTextColor(...ACCENT);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    const companyName = (company.name || "Facility").toUpperCase();
    doc.text(doc.splitTextToSize(companyName, 105), textLeft, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    const companyLines = [
        company.motto || "",
        [company.address, company.street].filter(Boolean).join(", "),
        [phone(company.phonenumber) && `Tel: ${phone(company.phonenumber)}`, phone(company.alternativenumber)].filter(Boolean).join(" / "),
        [company.email, company.website].filter(Boolean).join("  ·  "),
    ].filter(Boolean);
    let companyY = y + 10.5;
    for (const line of companyLines) {
        const wrapped = doc.splitTextToSize(line, 105);
        doc.text(wrapped, textLeft, companyY);
        companyY += 4 * wrapped.length;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(...ACCENT);
    doc.text("INVOICE", pageWidth - margin, y + 8, { align: "right" });
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("ORGANIZATIONAL CREDIT BILLING", pageWidth - margin, y + 13, { align: "right" });
    y = Math.max(companyY, y + 24) + 2;
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
    // ── From / Bill to / Invoice details ───────────────────────
    const colWidth = (contentWidth - 8) / 3;
    const block = (title, x, rows, bold) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...MUTED);
        doc.text(title, x, y);
        let rowY = y + 5;
        if (bold) {
            doc.setFontSize(10);
            doc.setTextColor(...INK);
            const wrapped = doc.splitTextToSize(bold, colWidth);
            doc.text(wrapped, x, rowY);
            rowY += 4.5 * wrapped.length;
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...INK);
        for (const row of rows.filter(Boolean)) {
            const wrapped = doc.splitTextToSize(row, colWidth);
            doc.text(wrapped, x, rowY);
            rowY += 4 * wrapped.length;
        }
        return rowY;
    };
    const fromEnd = block("FROM — SERVICE PROVIDER", margin, [
        [company.address, company.street].filter(Boolean).join(", "),
        phone(company.phonenumber) ? `Tel: ${phone(company.phonenumber)}` : "",
        company.email || "",
    ], company.name || "Facility");
    const billToEnd = block("BILL TO — CONTRACTED ORGANIZATION", margin + colWidth + 4, org ? [
        [org.address, org.street, org.location, org.region].filter(Boolean).join(", "),
        org.contact?.name ? `Attn: ${org.contact.name}` : "Attn: Accounts Department",
        [phone(org.mobile || org.contact?.mobile), org.email || org.contact?.email].filter(Boolean).join("  ·  "),
        invoice.reference ? `Ref / Contract: ${invoice.reference}` : "",
    ] : [], org?.name || "Organization");
    const metaX = margin + (colWidth + 4) * 2;
    (0,jspdf_autotable__WEBPACK_IMPORTED_MODULE_1__["default"])(doc, {
        startY: y - 3,
        margin: { left: metaX, right: margin },
        tableWidth: colWidth,
        theme: "plain",
        styles: { fontSize: 8.5, cellPadding: { top: 1, bottom: 1, left: 1.5, right: 1.5 }, textColor: INK },
        columnStyles: { 0: { textColor: MUTED, cellWidth: 24 }, 1: { fontStyle: "bold", halign: "right" } },
        body: [
            ["Invoice No.", invoice.invoice_number],
            ["Invoice Date", formatDate(invoice.invoice_date)],
            ["Due Date", formatDate(invoice.due_date)],
            ["Status", STATUS_LABELS[invoice.status] || invoice.status],
            ["Terms", invoice.payment_terms || "As agreed in contract"],
        ],
    });
    const metaEnd = doc.lastAutoTable.finalY;
    y = Math.max(fromEnd, billToEnd, metaEnd) + 6;
    // ── Line items ─────────────────────────────────────────────
    const showDiscount = Number(invoice.discount_total) > 0;
    const showTax = Number(invoice.tax_total) > 0;
    const showPrior = Number(invoice.prior_credits) > 0;
    const head = ["#", "Date", "Patient / Bill Ref.", "Service / Test", "Qty", `Unit (${CURRENCY})`];
    if (showDiscount)
        head.push("Discount");
    if (showTax)
        head.push("Tax");
    if (showPrior)
        head.push("Prior Credit");
    head.push(`Amount Due (${CURRENCY})`);
    const body = lines.map((line, index) => {
        const row = [
            String(index + 1),
            line.service_date ? new Date(line.service_date).toLocaleDateString("en-GB") : "",
            `${line.patient_name}\nBill #${line.billing_id}`,
            line.description,
            String(line.quantity),
            money(line.unit_price),
        ];
        if (showDiscount)
            row.push(money(line.discount));
        if (showTax)
            row.push(money(line.tax));
        if (showPrior)
            row.push(money(line.prior_credit));
        row.push(money(line.amount_due));
        return row;
    });
    const numericStart = 4;
    const columnStyles = { 0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: 20 }, 2: { cellWidth: 38 } };
    for (let i = numericStart; i < head.length; i++)
        columnStyles[i] = { halign: "right", cellWidth: i === numericStart ? 10 : undefined };
    (0,jspdf_autotable__WEBPACK_IMPORTED_MODULE_1__["default"])(doc, {
        startY: y,
        margin: { left: margin, right: margin, top: 20, bottom: 20 },
        head: [head],
        body,
        theme: "striped",
        headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8, halign: "center" },
        styles: { fontSize: 8, cellPadding: 1.8, textColor: INK, overflow: "linebreak", valign: "middle" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles,
    });
    y = doc.lastAutoTable.finalY + 4;
    // ── Totals ────────────────────────────────────────────────
    const totalsRows = [["Subtotal", money(invoice.subtotal)]];
    if (showDiscount)
        totalsRows.push(["Less: discounts", `(${money(invoice.discount_total)})`]);
    if (showTax)
        totalsRows.push(["Tax", money(invoice.tax_total)]);
    totalsRows.push(["Total charges", money(invoice.total_amount)]);
    if (showPrior)
        totalsRows.push(["Less: settled before invoicing", `(${money(invoice.prior_credits)})`]);
    totalsRows.push(["Amount invoiced", money(invoice.amount_due)]);
    totalsRows.push(["Payments received", `(${money(invoice.amount_paid)})`]);
    const totalsWidth = 82;
    if (y + 8 + totalsRows.length * 6 + 14 > pageHeight - 25) {
        doc.addPage();
        y = 20;
    }
    const totalsTop = y;
    (0,jspdf_autotable__WEBPACK_IMPORTED_MODULE_1__["default"])(doc, {
        startY: y,
        margin: { left: pageWidth - margin - totalsWidth, right: margin },
        tableWidth: totalsWidth,
        theme: "plain",
        styles: { fontSize: 9, cellPadding: { top: 1.2, bottom: 1.2, left: 2, right: 2 }, textColor: INK },
        columnStyles: { 0: { textColor: MUTED }, 1: { halign: "right" } },
        body: totalsRows,
    });
    y = doc.lastAutoTable.finalY + 1;
    doc.setFillColor(...ACCENT);
    doc.rect(pageWidth - margin - totalsWidth, y, totalsWidth, 11, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("BALANCE DUE", pageWidth - margin - totalsWidth + 3, y + 7);
    doc.setFontSize(12);
    doc.text(`${CURRENCY} ${money(invoice.balance_due)}`, pageWidth - margin - 3, y + 7.3, { align: "right" });
    const totalsBottom = y + 11;
    // Payment instructions sit beside the totals.
    const leftWidth = contentWidth - totalsWidth - 8;
    let leftY = totalsTop + 3;
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("PAYMENT INSTRUCTIONS", margin, leftY);
    leftY += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    const instructions = [
        company.additionalInfo ? String(company.additionalInfo) : "Please pay using the facility's approved bank or payment details.",
        `Quote invoice number ${invoice.invoice_number} with your payment.`,
    ];
    for (const text of instructions) {
        const wrapped = doc.splitTextToSize(text, leftWidth);
        doc.text(wrapped, margin, leftY);
        leftY += 4 * wrapped.length + 1;
    }
    if (invoice.notes) {
        leftY += 2;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...MUTED);
        doc.text("NOTES", margin, leftY);
        leftY += 4.5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...INK);
        const wrapped = doc.splitTextToSize(invoice.notes, leftWidth);
        doc.text(wrapped, margin, leftY);
        leftY += 4 * wrapped.length;
    }
    y = Math.max(totalsBottom, leftY) + 8;
    // ── Payment history ───────────────────────────────────────
    if (payments.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...ACCENT);
        doc.text("PAYMENTS RECEIVED", margin, y);
        (0,jspdf_autotable__WEBPACK_IMPORTED_MODULE_1__["default"])(doc, {
            startY: y + 2,
            margin: { left: margin, right: margin, top: 20, bottom: 20 },
            head: [["Date", "Mode", "Reference", `Amount (${CURRENCY})`]],
            body: payments.map(p => [formatDate(p.payment_date), p.payment_mode || "", p.reference || "", money(p.amount)]),
            theme: "grid",
            headStyles: { fillColor: LIGHT, textColor: INK, fontStyle: "bold", fontSize: 8 },
            styles: { fontSize: 8, cellPadding: 1.5, textColor: INK, lineColor: [210, 214, 220], lineWidth: 0.2 },
            columnStyles: { 3: { halign: "right" } },
        });
        y = doc.lastAutoTable.finalY + 8;
    }
    // ── Sign-off ──────────────────────────────────────────────
    if (y + 22 > pageHeight - 20) {
        doc.addPage();
        y = 25;
    }
    doc.setDrawColor(...MUTED);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 10, margin + 70, y + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("Authorized by (name, signature & stamp)", margin, y + 14);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...ACCENT);
    doc.text("Thank you for your continued partnership.", pageWidth - margin, y + 14, { align: "right" });
    // ── Status stamp, footer & page numbers on every page ─────
    const pageCount = doc.getNumberOfPages();
    const generated = new Date().toLocaleString("en-GB");
    for (let page = 1; page <= pageCount; page++) {
        doc.setPage(page);
        if (invoice.status === "void" || invoice.status === "paid") {
            const label = invoice.status === "void" ? "VOID" : "PAID";
            const color = invoice.status === "void" ? [200, 35, 51] : [25, 135, 84];
            doc.saveGraphicsState();
            doc.setGState(new doc.GState({ opacity: 0.12 }));
            doc.setTextColor(...color);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(90);
            doc.text(label, pageWidth / 2, pageHeight / 2, { align: "center", angle: 30 });
            doc.restoreGraphicsState();
        }
        doc.setDrawColor(220, 224, 230);
        doc.setLineWidth(0.3);
        doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...MUTED);
        doc.text(`${company.name || ""}  ·  Invoice ${invoice.invoice_number}`, margin, pageHeight - 9);
        doc.text(`Generated ${generated}`, pageWidth / 2, pageHeight - 9, { align: "center" });
        doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 9, { align: "right" });
        if (invoice.status === "void" && page === 1 && invoice.void_reason) {
            doc.setTextColor(200, 35, 51);
            doc.text(`Voided: ${invoice.void_reason}`.slice(0, 120), margin, pageHeight - 5);
        }
    }
    return doc;
}


/***/ }),

/***/ "../lobnos/components/reports/reportPdf.ts":
/*!*************************************************!*\
  !*** ../lobnos/components/reports/reportPdf.ts ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   EXPORT_MAX_ROWS: () => (/* binding */ EXPORT_MAX_ROWS),
/* harmony export */   EXPORT_PAGE_SIZE: () => (/* binding */ EXPORT_PAGE_SIZE),
/* harmony export */   buildReportPdf: () => (/* binding */ buildReportPdf),
/* harmony export */   cellText: () => (/* reexport safe */ _tableSources__WEBPACK_IMPORTED_MODULE_6__.cellText),
/* harmony export */   collectReport: () => (/* binding */ collectReport),
/* harmony export */   exportReportPdf: () => (/* binding */ exportReportPdf),
/* harmony export */   exportTablesCsv: () => (/* binding */ exportTablesCsv),
/* harmony export */   fetchAllPages: () => (/* binding */ fetchAllPages),
/* harmony export */   filtersFromElement: () => (/* binding */ filtersFromElement),
/* harmony export */   loadCompanyBranding: () => (/* binding */ loadCompanyBranding),
/* harmony export */   notesFromElement: () => (/* binding */ notesFromElement),
/* harmony export */   pdfSafe: () => (/* binding */ pdfSafe),
/* harmony export */   reportFileName: () => (/* binding */ reportFileName),
/* harmony export */   tableFromElement: () => (/* binding */ tableFromElement),
/* harmony export */   tablesFromElement: () => (/* binding */ tablesFromElement),
/* harmony export */   textOf: () => (/* binding */ textOf)
/* harmony export */ });
/* harmony import */ var jspdf__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! jspdf */ "../lobnos/node_modules/jspdf/dist/jspdf.es.min.js");
/* harmony import */ var jspdf_autotable__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! jspdf-autotable */ "../lobnos/node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.mjs");
/* harmony import */ var _invoices_organizationInvoicePdf__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../invoices/organizationInvoicePdf */ "../lobnos/components/invoices/organizationInvoicePdf.ts");
/* harmony import */ var _Auth_customFetch__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../Auth/customFetch */ "./tmp/settings-ui-polish/browser-17468/fetch.ts");
/* harmony import */ var _serverActions_requestHeaders__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../serverActions/requestHeaders */ "../lobnos/components/serverActions/requestHeaders.tsx");
/* harmony import */ var _lib_companyImage__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../../lib/companyImage */ "../lobnos/lib/companyImage.ts");
/* harmony import */ var _tableSources__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./tableSources */ "../lobnos/components/reports/tableSources.ts");








const EXPORT_PAGE_SIZE = 500;
const EXPORT_MAX_ROWS = 10000;
const DANGER = [200, 35, 51];
const SUCCESS = [25, 135, 84];
let brandingCache = null;
function pick(row, key) {
    if (!row)
        return undefined;
    const found = Object.keys(row).find((k) => k.toLowerCase() === key.toLowerCase());
    return found ? row[found] : undefined;
}
async function loadLogo(tenantId) {
    try {
        const url = (0,_lib_companyImage__WEBPACK_IMPORTED_MODULE_5__.companyImageUrl)(tenantId);
        if (!url)
            return null;
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok)
            return null;
        const blob = await res.blob();
        if (!blob.size || !blob.type.startsWith("image/"))
            return null;
        return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    }
    catch {
        return null;
    }
}
async function loadCompanyBranding() {
    const tenantId = (await (0,_serverActions_requestHeaders__WEBPACK_IMPORTED_MODULE_4__.getRequestContext)())?.tenantId;
    if (brandingCache && brandingCache.tenantId === tenantId)
        return brandingCache.value;
    let raw = null;
    try {
        const res = await (0,_Auth_customFetch__WEBPACK_IMPORTED_MODULE_3__.customFetch)(`settings/companyprofile?tenantId=${tenantId}`);
        raw = res?.data ?? res?.result ?? res;
        if (Array.isArray(raw))
            raw = raw[0];
    }
    catch {
        raw = null;
    }
    const keys = ["name", "email", "motto", "phonenumber", "alternativenumber", "address", "street", "website"];
    const company = {};
    for (const k of keys)
        company[k] = pick(raw, k);
    const value = { company, logo: await loadLogo(tenantId) };
    brandingCache = { tenantId, value };
    return value;
}
/**
 * Reads every page from a paginated source. Stops on a short/empty page, a repeated page (a source
 * that ignores `page`), or the row cap, so a misbehaving endpoint can never loop forever.
 */
async function fetchAllPages(fetchPage, options = {}) {
    const pageSize = options.pageSize ?? EXPORT_PAGE_SIZE;
    const maxRows = options.maxRows ?? EXPORT_MAX_ROWS;
    const rows = [];
    let previousFirst = null;
    let truncated = false;
    for (let page = 1;; page++) {
        const batch = (await fetchPage(page, pageSize)) || [];
        if (!Array.isArray(batch) || batch.length === 0)
            break;
        const first = JSON.stringify(batch[0]);
        if (previousFirst !== null && first === previousFirst)
            break;
        previousFirst = first;
        rows.push(...batch);
        if (rows.length >= maxRows) {
            truncated = rows.length > maxRows || batch.length >= pageSize;
            break;
        }
        if (batch.length < pageSize)
            break;
    }
    return { rows: rows.slice(0, maxRows), truncated };
}
// ── Reading reports from the rendered page ───────────────────────────────
const JUNK = "button, .btn, input, select, textarea, svg, .dropdown, .spinner-border, .spinner-grow, [data-pdf-ignore], .visually-hidden, .sr-only, [hidden]";
const BLOCK = new Set(["DIV", "P", "BR", "LI", "UL", "OL", "SMALL", "H1", "H2", "H3", "H4", "H5", "H6", "TR", "SECTION"]);
/** Inline elements whose on-screen separation comes from CSS (e.g. `<span class="me-2">acc-1000</span>Cash`). */
const SPACED_INLINE = /\b(m[sexy]|p[sexy]|gap)-(\d|auto)\b|\bbadge\b/;
const SPACED_TAGS = new Set(["CODE", "KBD", "TD", "TH"]);
/** Visible text of an element with controls stripped; block children become separate lines. */
function textOf(node) {
    const parts = [];
    const walk = (n) => {
        if (n.nodeType === Node.TEXT_NODE) {
            parts.push(n.nodeValue || "");
            return;
        }
        if (n.nodeType !== Node.ELEMENT_NODE)
            return;
        const el = n;
        if (el !== node && el.matches(JUNK))
            return;
        if (el.style?.display === "none")
            return;
        if (el.classList.contains("d-none") && !/\bd-(sm|md|lg|xl|xxl)-(?!none)/.test(String(el.className)))
            return;
        const block = BLOCK.has(el.tagName);
        const spaced = !block && (SPACED_TAGS.has(el.tagName) || SPACED_INLINE.test(String(el.className)));
        if (block)
            parts.push("\n");
        else if (spaced)
            parts.push(" ");
        if (el.tagName === "BR")
            return;
        el.childNodes.forEach(walk);
        if (block)
            parts.push("\n");
        else if (spaced)
            parts.push(" ");
    };
    walk(node);
    return parts
        .join("")
        .split("\n")
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join("\n");
}
function isVisible(el) {
    return el.offsetParent !== null || el.getClientRects().length > 0;
}
function hasClass(el, pattern) {
    return !!el && pattern.test(el.className && typeof el.className === "string" ? el.className : "");
}
function readRow(tr) {
    const rowBold = hasClass(tr, /\b(fw-bold|fw-semibold|table-secondary|table-light|table-active)\b/);
    return Array.from(tr.cells).map((cell) => {
        const first = cell.firstElementChild;
        const toneSource = (pattern) => hasClass(cell, pattern) || (cell.childElementCount === 1 && hasClass(first, pattern));
        const tone = toneSource(/\btext-danger\b/) ? "danger" : toneSource(/\btext-success\b/) ? "success" : undefined;
        return {
            text: textOf(cell),
            span: Math.max(1, Number(cell.colSpan) || 1),
            bold: rowBold || cell.tagName === "TH" || hasClass(cell, /\b(fw-bold|fw-semibold)\b/),
            indent: hasClass(cell, /\bps-5\b/) ? 2 : hasClass(cell, /\bps-4\b/) ? 1 : 0,
            tone,
        };
    });
}
function expandedWidth(cells) {
    return cells.reduce((sum, c) => sum + c.span, 0);
}
/** Converts one HTML table into a report table, dropping action/control columns. */
function tableFromElement(table, heading) {
    const headRows = table.tHead ? Array.from(table.tHead.rows) : [];
    const footRows = table.tFoot ? Array.from(table.tFoot.rows) : [];
    const bodyRows = Array.from(table.tBodies).flatMap((b) => Array.from(b.rows));
    const headRow = headRows.length ? readRow(headRows[headRows.length - 1]) : null;
    const body = bodyRows.map(readRow);
    const foot = footRows.map(readRow);
    const heads = [];
    headRow?.forEach((c) => {
        heads.push(c.text.replace(/\n/g, " "));
        for (let k = 1; k < c.span; k++)
            heads.push("");
    });
    const width = headRow ? heads.length : Math.max(0, ...body.map(expandedWidth), ...foot.map(expandedWidth));
    if (!width)
        return null;
    // Text found in each column of single-span body cells, to tell action columns from data columns.
    const columnHasText = new Array(width).fill(false);
    body.forEach((cells) => {
        let pos = 0;
        cells.forEach((c) => {
            if (c.span === 1 && c.text && pos < width)
                columnHasText[pos] = true;
            pos += c.span;
        });
    });
    const skip = new Array(width).fill(false).map((_, i) => {
        if (!headRow)
            return false;
        const h = heads[i]?.trim() || "";
        if (/^(actions?|options?|manage)$/i.test(h))
            return true;
        return !h && !columnHasText[i];
    });
    const keptWidth = skip.filter((s) => !s).length;
    if (!keptWidth)
        return null;
    const convert = (cells, isBody) => {
        if (!cells.some((c) => c.text))
            return null;
        const out = [];
        let pos = 0;
        for (const c of cells) {
            if (pos >= width)
                break;
            const end = Math.min(width, pos + c.span);
            let kept = 0;
            for (let i = pos; i < end; i++)
                if (!skip[i])
                    kept++;
            pos += c.span;
            if (!kept)
                continue;
            const section = isBody && cells.length === 1 && kept === keptWidth && keptWidth > 1;
            if (kept === 1 && !c.bold && !c.indent && !c.tone)
                out.push(c.text);
            else
                out.push({ content: c.text, colSpan: kept > 1 ? kept : undefined, bold: c.bold || section || undefined, section: section || undefined, indent: c.indent || undefined, tone: c.tone });
        }
        const filled = out.reduce((sum, c) => sum + (typeof c === "string" ? 1 : c.colSpan || 1), 0);
        for (let i = filled; i < keptWidth; i++)
            out.push("");
        return out;
    };
    return {
        heading,
        head: headRow ? heads.filter((_, i) => !skip[i]) : undefined,
        body: body.map((r) => convert(r, true)).filter((r) => !!r),
        foot: foot.map((r) => convert(r, false)).filter((r) => !!r),
    };
}
const HEADING_SELECTOR = "h4, h5, h6, .card-header, .card-title, [data-pdf-heading]";
function headingsBefore(root, tables) {
    const candidates = Array.from(root.querySelectorAll(HEADING_SELECTOR)).filter((h) => !h.closest("table, [data-pdf-ignore]") && isVisible(h) && !h.querySelector("table"));
    return tables.map((table, index) => {
        const previous = tables[index - 1];
        let found;
        for (const h of candidates) {
            const beforeTable = !!(h.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING) && !h.contains(table);
            const afterPrevious = !previous || !!(previous.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING);
            if (beforeTable && afterPrevious)
                found = h;
        }
        const text = found ? textOf(found).split("\n")[0] : "";
        return text || undefined;
    });
}
/** Reads the visible tables of a rendered report, exactly as the user sees them. */
function tablesFromElement(root) {
    const tables = Array.from(root.querySelectorAll("table")).filter((t) => !t.closest("[data-pdf-ignore]") && !t.parentElement?.closest("table") && isVisible(t));
    const headings = headingsBefore(root, tables);
    return tables.map((t, i) => tableFromElement(t, headings[i])).filter((t) => !!t);
}
/** Alerts and explicitly marked notes, e.g. the balance-sheet balance check. */
function notesFromElement(root) {
    return Array.from(root.querySelectorAll(".alert, [data-pdf-note]"))
        .filter((el) => !el.closest("table, [data-pdf-ignore]") && isVisible(el))
        .map((el) => textOf(el).replace(/\n/g, " "))
        .filter(Boolean);
}
/** "Label: value" for each labelled filter control that has a value. */
function filtersFromElement(root) {
    if (!root)
        return [];
    const result = [];
    root.querySelectorAll("label").forEach((label) => {
        const name = textOf(label).replace(/\n/g, " ").replace(/:$/, "");
        if (!name)
            return;
        const control = ((label.htmlFor && document.getElementById(label.htmlFor)) ||
            label.querySelector("select, input, textarea") ||
            label.parentElement?.querySelector("select, input:not([type=hidden]), textarea"));
        if (!control)
            return;
        let value = "";
        if (control instanceof HTMLSelectElement)
            value = Array.from(control.selectedOptions).map((o) => o.text).join(", ");
        else if (control.type === "checkbox" || control.type === "radio")
            value = control.checked ? "Yes" : "";
        else
            value = control.value;
        if (value && value.trim())
            result.push(`${name}: ${value.trim()}`);
    });
    return result;
}
/**
 * Collects a report from the page. Tables registered as data sources (e.g. server-paginated
 * PrimeTables) supply their full dataset instead of the rows currently on screen.
 */
async function collectReport(root) {
    const elements = Array.from(root.querySelectorAll("table")).filter((t) => !t.closest("[data-pdf-ignore]") && !t.parentElement?.closest("table") && isVisible(t));
    const headings = headingsBefore(root, elements);
    const tables = [];
    const notes = notesFromElement(root);
    const done = new Set();
    for (let i = 0; i < elements.length; i++) {
        const registered = (0,_tableSources__WEBPACK_IMPORTED_MODULE_6__.findTableSource)(elements[i], root);
        if (registered) {
            if (done.has(registered.element))
                continue;
            done.add(registered.element);
            const result = await registered.source();
            result.tables.forEach((t) => tables.push({ ...t, heading: t.heading || headings[i] }));
            notes.push(...(result.notes || []));
            continue;
        }
        const table = tableFromElement(elements[i], headings[i]);
        if (table)
            tables.push(table);
    }
    return { tables, notes };
}
// ── Rendering ────────────────────────────────────────────────────────────
const NUMERIC = /^[\s(+-]*(GH[S₵]|₵)?\s*[\d,]+(\.\d+)?\s*%?\)?\s*(Dr|Cr)?$/i;
function isNumericColumn(table, col) {
    const values = [];
    for (const row of table.body) {
        let pos = 0;
        for (const cell of row) {
            const span = typeof cell === "string" ? 1 : cell.colSpan || 1;
            if (pos === col && span === 1)
                values.push((0,_tableSources__WEBPACK_IMPORTED_MODULE_6__.cellText)(cell).trim());
            pos += span;
        }
    }
    const filled = values.filter((v) => v && v !== "-" && v !== "—");
    return filled.length > 0 && filled.every((v) => NUMERIC.test(v));
}
function tableWidth(table) {
    if (table.head?.length)
        return table.head.length;
    return Math.max(0, ...table.body.map((r) => r.reduce((s, c) => s + (typeof c === "string" ? 1 : c.colSpan || 1), 0)));
}
function reportFileName(title, period) {
    const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const date = new Date().toISOString().slice(0, 10);
    return `${[slug(title), period ? slug(period) : ""].filter(Boolean).join("_")}_${date}.pdf`;
}
/**
 * jsPDF's built-in fonts only cover Latin-1/WinAnsi, so glyphs such as the cedi sign (₵),
 * narrow no-break spaces from Intl formatting, or the Unicode minus print as garbage ("GH µ").
 * Currency is written as "GHS", consistent with the organization invoice PDF.
 */
function pdfSafe(text) {
    return text
        .replace(/(?:GH\s*)?\u20B5\s*/g, "GHS ")
        .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ")
        .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
        .replace(/[\u2212\u2010-\u2015]/g, "-")
        .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
        .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
        .replace(/\u2026/g, "...")
        .replace(/[\u2022\u2219]/g, "\u00B7")
        .replace(/\u2264/g, "<=")
        .replace(/\u2265/g, ">=")
        .replace(/\u2192/g, "->")
        .replace(/[^\n\t\u0020-\u007E\u00A0-\u00FF]/g, "");
}
function pdfSafeDeep(value) {
    if (typeof value === "string")
        return pdfSafe(value);
    if (Array.isArray(value))
        return value.map(pdfSafeDeep);
    if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
        const out = {};
        for (const [key, inner] of Object.entries(value))
            out[key] = pdfSafeDeep(inner);
        return out;
    }
    return value;
}
function buildReportPdf(rawSpec, branding) {
    const spec = pdfSafeDeep(rawSpec);
    const company = pdfSafeDeep(branding.company || {});
    const doc = new jspdf__WEBPACK_IMPORTED_MODULE_0__["default"]({ unit: "mm", format: "a4", orientation: "landscape", compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;
    doc.setProperties({ title: spec.title.toUpperCase(), subject: "PLS report", creator: "Prime Laboratory Software" });
    // ── Letterhead ──────────────────────────────────────────
    let y = margin;
    let textLeft = margin;
    if (branding.logo) {
        try {
            doc.addImage(branding.logo, (0,_invoices_organizationInvoicePdf__WEBPACK_IMPORTED_MODULE_2__.imageFormat)(branding.logo), margin, y, 20, 20);
            textLeft = margin + 24;
        }
        catch {
            textLeft = margin;
        }
    }
    doc.setTextColor(..._invoices_organizationInvoicePdf__WEBPACK_IMPORTED_MODULE_2__.ACCENT);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    const nameLines = doc.splitTextToSize(String(company.name || "Facility").toUpperCase(), 140);
    doc.text(nameLines, textLeft, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(..._invoices_organizationInvoicePdf__WEBPACK_IMPORTED_MODULE_2__.MUTED);
    const lines = [
        company.motto || "",
        [company.address, company.street].filter(Boolean).join(", "),
        [(0,_invoices_organizationInvoicePdf__WEBPACK_IMPORTED_MODULE_2__.phone)(company.phonenumber) && `Tel: ${(0,_invoices_organizationInvoicePdf__WEBPACK_IMPORTED_MODULE_2__.phone)(company.phonenumber)}`, (0,_invoices_organizationInvoicePdf__WEBPACK_IMPORTED_MODULE_2__.phone)(company.alternativenumber)].filter(Boolean).join(" / "),
        [company.email, company.website].filter(Boolean).join("  ·  "),
    ].filter(Boolean);
    let ly = y + 5 + 5.5 * nameLines.length - 1;
    for (const line of lines) {
        const wrapped = doc.splitTextToSize(String(line), 140);
        doc.text(wrapped, textLeft, ly);
        ly += 3.8 * wrapped.length;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.setTextColor(..._invoices_organizationInvoicePdf__WEBPACK_IMPORTED_MODULE_2__.ACCENT);
    const titleLines = doc.splitTextToSize(spec.title.toUpperCase(), 110);
    doc.text(titleLines, pageWidth - margin, y + 6, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(..._invoices_organizationInvoicePdf__WEBPACK_IMPORTED_MODULE_2__.MUTED);
    let ry = y + 6 + 6.5 * titleLines.length;
    for (const line of [spec.subtitle, spec.period, ...(spec.filters || [])].filter(Boolean)) {
        const wrapped = doc.splitTextToSize(line, 110);
        doc.text(wrapped, pageWidth - margin, ry, { align: "right" });
        ry += 4 * wrapped.length;
    }
    y = Math.max(ly, ry, y + 22) + 1;
    doc.setDrawColor(..._invoices_organizationInvoicePdf__WEBPACK_IMPORTED_MODULE_2__.ACCENT);
    doc.setLineWidth(0.7);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    // ── Notes ───────────────────────────────────────────────
    const notes = Array.from(new Set((spec.notes || []).map((n) => n.trim()).filter(Boolean)));
    if (notes.length) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        const wrapped = notes.map((n) => doc.splitTextToSize(n, contentWidth - 6));
        const height = wrapped.reduce((h, w) => h + w.length * 4, 0) + 4;
        doc.setFillColor(..._invoices_organizationInvoicePdf__WEBPACK_IMPORTED_MODULE_2__.LIGHT);
        doc.rect(margin, y - 1, contentWidth, height, "F");
        doc.setTextColor(..._invoices_organizationInvoicePdf__WEBPACK_IMPORTED_MODULE_2__.INK);
        let ny = y + 3;
        for (const w of wrapped) {
            doc.text(w, margin + 3, ny);
            ny += 4 * w.length;
        }
        y += height + 4;
    }
    // ── Tables ──────────────────────────────────────────────
    const tables = spec.tables.filter((t) => tableWidth(t) > 0);
    if (!tables.length) {
        doc.setFontSize(10);
        doc.setTextColor(..._invoices_organizationInvoicePdf__WEBPACK_IMPORTED_MODULE_2__.INK);
        doc.text("No data for the selected filters.", margin, y + 4);
    }
    for (const table of tables) {
        const width = tableWidth(table);
        if (y > pageHeight - 30) {
            doc.addPage();
            y = margin;
        }
        if (table.heading) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(..._invoices_organizationInvoicePdf__WEBPACK_IMPORTED_MODULE_2__.INK);
            doc.text(table.heading.toUpperCase(), margin, y + 3);
            y += 6;
        }
        // Many columns get a smaller (still legible) font instead of being clipped.
        const fontSize = width > 14 ? 6.5 : width > 10 ? 7 : 8;
        const align = Array.from({ length: width }, (_, i) => (isNumericColumn(table, i) ? "right" : "left"));
        const toCell = (cell, index) => {
            if (typeof cell === "string")
                return { content: cell, styles: { halign: align[index] } };
            const styles = { halign: (cell.colSpan || 1) > 1 ? "left" : align[index] };
            if (cell.bold)
                styles.fontStyle = "bold";
            if (cell.section)
                styles.fillColor = _invoices_organizationInvoicePdf__WEBPACK_IMPORTED_MODULE_2__.LIGHT;
            if (cell.indent)
                styles.cellPadding = { top: 1.6, bottom: 1.6, right: 1.6, left: 1.6 + cell.indent * 4 };
            if (cell.tone === "danger")
                styles.textColor = DANGER;
            if (cell.tone === "success")
                styles.textColor = SUCCESS;
            if (cell.tone === "muted")
                styles.textColor = _invoices_organizationInvoicePdf__WEBPACK_IMPORTED_MODULE_2__.MUTED;
            return { content: cell.content, colSpan: cell.colSpan, styles };
        };
        const mapRow = (row) => {
            let pos = 0;
            return row.map((cell) => {
                const out = toCell(cell, pos);
                pos += typeof cell === "string" ? 1 : cell.colSpan || 1;
                return out;
            });
        };
        const body = table.body.length
            ? table.body.map(mapRow)
            : [[{ content: "No records found.", colSpan: width, styles: { halign: "center", textColor: _invoices_organizationInvoicePdf__WEBPACK_IMPORTED_MODULE_2__.MUTED } }]];
        (0,jspdf_autotable__WEBPACK_IMPORTED_MODULE_1__["default"])(doc, {
            startY: y,
            head: table.head?.length ? [table.head.map((h, i) => ({ content: h.toUpperCase(), styles: { halign: align[i] } }))] : undefined,
            body,
            foot: table.foot?.length ? table.foot.map(mapRow) : undefined,
            showHead: "everyPage",
            showFoot: "lastPage",
            theme: "grid",
            margin: { left: margin, right: margin, top: margin, bottom: 14 },
            styles: { font: "helvetica", fontSize, cellPadding: 1.6, textColor: _invoices_organizationInvoicePdf__WEBPACK_IMPORTED_MODULE_2__.INK, lineColor: [210, 214, 220], lineWidth: 0.1, overflow: "linebreak", valign: "middle" },
            headStyles: { fillColor: _invoices_organizationInvoicePdf__WEBPACK_IMPORTED_MODULE_2__.ACCENT, textColor: [255, 255, 255], fontStyle: "bold" },
            footStyles: { fillColor: _invoices_organizationInvoicePdf__WEBPACK_IMPORTED_MODULE_2__.LIGHT, textColor: _invoices_organizationInvoicePdf__WEBPACK_IMPORTED_MODULE_2__.INK, fontStyle: "bold" },
            alternateRowStyles: { fillColor: [248, 249, 251] },
        });
        y = (doc.lastAutoTable?.finalY ?? y) + 8;
    }
    // ── Footer on every page ────────────────────────────────
    const total = doc.getNumberOfPages();
    const generated = new Date().toLocaleString("en-GB");
    for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setDrawColor(220, 224, 230);
        doc.setLineWidth(0.3);
        doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(..._invoices_organizationInvoicePdf__WEBPACK_IMPORTED_MODULE_2__.MUTED);
        doc.text([company.name, spec.title.toUpperCase()].filter(Boolean).join("  ·  "), margin, pageHeight - 6);
        doc.text(`Generated ${generated}`, pageWidth / 2, pageHeight - 6, { align: "center" });
        doc.text(`Page ${i} of ${total}`, pageWidth - margin, pageHeight - 6, { align: "right" });
    }
    return doc;
}
async function exportReportPdf(spec) {
    const branding = await loadCompanyBranding();
    buildReportPdf(spec, branding).save(reportFileName(spec.title, spec.period));
}
function exportTablesCsv(tables, title) {
    const quote = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const row = (cells) => cells.flatMap((c) => [quote((0,_tableSources__WEBPACK_IMPORTED_MODULE_6__.cellText)(c).replace(/\n/g, " ")), ...Array(Math.max(0, (typeof c === "string" ? 1 : c.colSpan || 1) - 1)).fill('""')]).join(",");
    const lines = tables.flatMap((t) => [...(t.head ? [row(t.head)] : []), ...t.body.map(row), ...(t.foot || []).map(row)]);
    const url = URL.createObjectURL(new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = reportFileName(title).replace(/\.pdf$/, ".csv");
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}


/***/ }),

/***/ "../lobnos/components/serverActions/requestHeaders.tsx":
/*!*************************************************************!*\
  !*** ../lobnos/components/serverActions/requestHeaders.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getRequestContext: () => (/* binding */ getRequestContext)
/* harmony export */ });
/* harmony import */ var next_headers__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/headers */ "../lobnos/node_modules/next/headers.js");
/* harmony import */ var jose__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! jose */ "../lobnos/node_modules/jose/dist/webapi/jwt/verify.js");
'use server';


async function getRequestContext() {
    const headersCookies = await (0,next_headers__WEBPACK_IMPORTED_MODULE_0__.cookies)();
    const PLS_SESSION = headersCookies.get('PLS-SESSION')?.value || '';
    const PLS_PRIME_TENANT_SESSION = headersCookies.get('pls-prime-tenant-session')?.value || '';
    const loginsessionId = headersCookies.get('loginsessionId')?.value || '';
    let tenantId = null;
    if (PLS_SESSION) {
        try {
            const secret = new TextEncoder().encode(process.env.JWT_SECRET_KEY);
            const { payload } = await (0,jose__WEBPACK_IMPORTED_MODULE_1__.jwtVerify)(PLS_SESSION, secret);
            const sessionTenantId = Number(payload.tenantId);
            if (Number.isSafeInteger(sessionTenantId) && sessionTenantId > 0) {
                tenantId = sessionTenantId;
            }
            else if (payload.tenantId === undefined) {
                const configuredTenantId = Number(process.env.TENANTID);
                tenantId = Number.isSafeInteger(configuredTenantId) && configuredTenantId > 0
                    ? configuredTenantId
                    : null;
            }
        }
        catch {
            tenantId = null;
        }
    }
    return {
        PLS_SESSION,
        PLS_PRIME_TENANT_SESSION,
        loginsessionId,
        tenantId,
    };
}


/***/ }),

/***/ "../lobnos/lib/apiBaseUrl.ts":
/*!***********************************!*\
  !*** ../lobnos/lib/apiBaseUrl.ts ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   API_PATH_PREFIX: () => (/* binding */ API_PATH_PREFIX),
/* harmony export */   apiPath: () => (/* binding */ apiPath),
/* harmony export */   buildApiUrl: () => (/* binding */ buildApiUrl),
/* harmony export */   getApiBaseUrl: () => (/* binding */ getApiBaseUrl),
/* harmony export */   usesTenantQuery: () => (/* binding */ usesTenantQuery)
/* harmony export */ });
/**
 * Resolves the PLS backend base URL for the environment the code runs in.
 *
 * Server-side rendering talks to the backend directly over the private
 * address configured for the deployment. Browser code must never use that
 * address: in facility mode the browser runs on a client laptop, where the
 * private backend address does not exist. Browser requests therefore use the
 * origin the page was served from and are proxied to the backend by the
 * Next.js server that rendered the page.
 */
const API_PATH_PREFIX = "/api/v1/";
function serverBaseUrl() {
    const configured =  true
        ? process.env.DEVELOPMENT_BASEURL
        : 0;
    return configured || API_PATH_PREFIX;
}
/**
 * Returns an absolute backend base URL ending in a trailing slash.
 */
function getApiBaseUrl() {
    if (typeof window !== "undefined") {
        return new URL(API_PATH_PREFIX, window.location.origin).toString();
    }
    return serverBaseUrl();
}
/**
 * Builds a backend URL for the supplied endpoint.
 *
 * @param endpoint - Endpoint relative to the backend API root, such as
 * `settings/companyprofile/images`.
 */
function buildApiUrl(endpoint) {
    return new URL(endpoint.replace(/^\/+/, ""), getApiBaseUrl()).toString();
}
function usesTenantQuery(endpoint) {
    return !/^marketplace(?:\/|\?|$)/.test(endpoint.replace(/^\/+/, ""));
}
/**
 * Builds a same-origin backend path for URLs that are resolved by the browser
 * after server-side rendering, such as image `src` attributes.
 */
function apiPath(endpoint) {
    return `${API_PATH_PREFIX}${endpoint.replace(/^\/+/, "")}`;
}


/***/ }),

/***/ "../lobnos/lib/companyImage.ts":
/*!*************************************!*\
  !*** ../lobnos/lib/companyImage.ts ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   companyImageUrl: () => (/* binding */ companyImageUrl),
/* harmony export */   scopedCompanyImageUrl: () => (/* binding */ scopedCompanyImageUrl)
/* harmony export */ });
/* harmony import */ var _apiBaseUrl__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./apiBaseUrl */ "../lobnos/lib/apiBaseUrl.ts");

/** No default tenant: an unknown facility must never display an installation logo. */
function companyImageUrl(tenantId) {
    if (typeof tenantId !== 'number' || !Number.isSafeInteger(tenantId) || tenantId <= 0)
        return '';
    return `${(0,_apiBaseUrl__WEBPACK_IMPORTED_MODULE_0__.apiPath)('settings/companyprofile/images')}?tenantId=${tenantId}`;
}
/** Report URLs come from the backend; do not revive old, unscoped logo URLs. */
function scopedCompanyImageUrl(logo) {
    if (!logo)
        return '';
    try {
        const url = new URL(logo, 'http://image.local');
        const tenant = url.searchParams.getAll('tenantId');
        if (!['http:', 'https:'].includes(url.protocol) ||
            url.pathname !== '/api/v1/settings/companyprofile/images' ||
            tenant.length !== 1 || !/^[1-9]\d*$/.test(tenant[0]) ||
            !Number.isSafeInteger(Number(tenant[0])))
            return '';
        // Use the browser's backend proxy, not an internal server hostname.
        return companyImageUrl(Number(tenant[0]));
    }
    catch {
        return '';
    }
}


/***/ })

}]);