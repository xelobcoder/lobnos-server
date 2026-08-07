/**
 * Commercial invoice-style HTML/plain layouts for procurement & supplier emails
 * (purchase orders, goods received, supplier payment advice) — marketplace style.
 */

export type InvoiceDocumentKind = 'purchase_order' | 'goods_received' | 'supplier_payment';

export type InvoiceDocumentParts = {
     subject: string;
     /** Document badge in header, e.g. PURCHASE ORDER */
     documentLabel: string;
     /** Main H1 */
     title: string;
     intro: string;
     /** Optional status chip text */
     statusLabel?: string;
     /** Primary reference shown large (order # / payment #) */
     documentNumberLabel: string;
     documentNumberValue: string;
     /** Meta rows: label + mustache value */
     metaLeft: Array<{ label: string; value: string }>;
     metaRight: Array<{ label: string; value: string }>;
     partyTitle: string;
     partyLines: string[];
     billFromTitle?: string;
     /** When true, include laboratory/branch as "From" block via variables */
     includeLabAsFrom?: boolean;
     /** Section heading above line table */
     itemsSectionTitle: string;
     /**
      * HTML table body rows variable, e.g. {{purchase_order_items_html}}
      * Must already be safe HTML rows (<tr>...</tr>).
      */
     itemsRowsHtmlToken: string;
     /** Column headers for the line table */
     itemColumns: string[];
     /** Plain-text items block token */
     itemsTextToken: string;
     /** Totals rows */
     totals: Array<{ label: string; value: string; emphasize?: boolean }>;
     notes?: string;
     footerNote?: string;
};

function escapeForAttr(s: string): string {
     return s.replace(/"/g, '&quot;');
}

function metaCell(label: string, value: string): string {
     return `
          <tr>
               <td style="padding: 4px 0; font-size: 12px; color: #64748b; width: 42%; vertical-align: top;">${label}</td>
               <td style="padding: 4px 0; font-size: 13px; color: #0f172a; font-weight: 600; vertical-align: top;">${value}</td>
          </tr>`;
}

function partyBlock(title: string, lines: string[]): string {
     const body = lines
          .map((line) => `<p style="margin: 0 0 4px 0; font-size: 13px; line-height: 1.55; color: #334155;">${line}</p>`)
          .join('');
     return `
          <td width="50%" valign="top" style="padding: 0 8px 0 0;">
               <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: #64748b;">${title}</p>
               ${body}
          </td>`;
}

function buildItemsTableHeader(columns: string[]): string {
     return columns
          .map((col, i) => {
               const isFirst = i === 0;
               const isNumeric = i >= Math.max(1, columns.length - 3);
               const align = isNumeric ? 'right' : 'left';
               const width = isFirst ? ' width="36"' : '';
               return `<th align="${align}"${width} style="padding: 12px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.55px; color: #ffffff; background: #0b3a6e; border-bottom: 0;">${col}</th>`;
          })
          .join('');
}

export function buildInvoiceDocumentHtml(parts: InvoiceDocumentParts): string {
     const leftMeta = parts.metaLeft.map((m) => metaCell(m.label, m.value)).join('');
     const rightMeta = parts.metaRight.map((m) => metaCell(m.label, m.value)).join('');

     const fromBlock = parts.includeLabAsFrom
          ? partyBlock(parts.billFromTitle || 'From', [
               '<strong>{{laboratory_name}}</strong>',
               '{{branch_name}}',
               '{{branch_address}}',
               '{{branch_phone}} · {{branch_email}}',
          ])
          : '';

     const toBlock = partyBlock(parts.partyTitle, parts.partyLines);

     const statusChip = parts.statusLabel
          ? `<span style="display: inline-block; margin-left: 10px; padding: 4px 10px; border-radius: 999px; background: #ecfdf5; color: #047857; font-size: 11px; font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase; border: 1px solid #a7f3d0;">${parts.statusLabel}</span>`
          : '';

     const totalsHtml = parts.totals
          .map((t) => {
               if (t.emphasize) {
                    return `
                         <tr>
                              <td style="padding: 14px 16px; font-size: 13px; font-weight: 700; color: #ffffff; background: #0b3a6e; border-top: 1px solid #0a3260;">${t.label}</td>
                              <td align="right" style="padding: 14px 16px; font-size: 20px; font-weight: 800; color: #ffffff; background: #0b3a6e; border-top: 1px solid #0a3260; letter-spacing: 0.2px;">${t.value}</td>
                         </tr>`;
               }
               return `
                    <tr>
                         <td style="padding: 8px 16px; font-size: 13px; color: #64748b; background: #f8fafc;">${t.label}</td>
                         <td align="right" style="padding: 8px 16px; font-size: 13px; color: #0f172a; font-weight: 600; background: #f8fafc; font-variant-numeric: tabular-nums;">${t.value}</td>
                    </tr>`;
          })
          .join('');

     const notesBlock = parts.notes
          ? `
               <tr>
                    <td style="padding: 8px 28px 18px 28px; font-family: Segoe UI, Tahoma, Arial, sans-serif;">
                         <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px;">
                              <tr>
                                   <td style="padding: 14px 16px;">
                                        <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #92400e;">Notes</p>
                                        <p style="margin: 0; font-size: 13px; line-height: 1.65; color: #78350f;">${parts.notes}</p>
                                   </td>
                              </tr>
                         </table>
                    </td>
               </tr>`
          : '';

     const footerExtra = parts.footerNote
          ? `<p style="margin: 0 0 8px 0; font-size: 12px; line-height: 1.65;">${parts.footerNote}</p>`
          : '';

     return `
<!DOCTYPE html>
<html lang="en">
<head>
     <meta charset="UTF-8" />
     <meta name="viewport" content="width=device-width, initial-scale=1.0" />
     <meta http-equiv="X-UA-Compatible" content="IE=edge" />
     <title>${escapeForAttr(parts.title)}</title>
     <style>
          body { margin: 0; padding: 0; background: #eef2f7; }
          table { border-collapse: collapse; }
          @media only screen and (max-width: 640px) {
               .pls-shell { width: 100% !important; }
               .pls-pad { padding-left: 16px !important; padding-right: 16px !important; }
               .pls-stack td { display: block !important; width: 100% !important; padding-right: 0 !important; padding-bottom: 12px !important; }
          }
     </style>
</head>
<body>
     <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width: 100%; background: #eef2f7; padding: 24px 10px;">
          <tr>
               <td align="center">
                    <table role="presentation" class="pls-shell" width="720" cellspacing="0" cellpadding="0" style="width: 720px; max-width: 720px; background: #ffffff; border: 1px solid #dbe3ee; border-radius: 4px; overflow: hidden; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);">
                         <!-- Brand bar -->
                         <tr>
                              <td style="background: linear-gradient(90deg, #0b3a6e 0%, #0f4c8a 100%); padding: 0;">
                                   <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                        <tr>
                                             <td class="pls-pad" style="padding: 20px 28px 12px 28px; font-family: Segoe UI, Tahoma, Arial, sans-serif; color: #ffffff;">
                                                  <p style="margin: 0 0 4px 0; font-size: 12px; letter-spacing: 1px; font-weight: 600; opacity: 0.9;">{{laboratory_name}}</p>
                                                  <p style="margin: 0; font-size: 11px; letter-spacing: 1.4px; font-weight: 700; text-transform: uppercase; color: #93c5fd;">${parts.documentLabel}</p>
                                             </td>
                                             <td align="right" class="pls-pad" style="padding: 20px 28px 12px 28px; font-family: Segoe UI, Tahoma, Arial, sans-serif; color: #ffffff;">
                                                  <p style="margin: 0 0 2px 0; font-size: 11px; opacity: 0.85;">${parts.documentNumberLabel}</p>
                                                  <p style="margin: 0; font-size: 18px; font-weight: 800; letter-spacing: 0.3px;">${parts.documentNumberValue}</p>
                                             </td>
                                        </tr>
                                        <tr>
                                             <td colspan="2" class="pls-pad" style="padding: 4px 28px 20px 28px; font-family: Segoe UI, Tahoma, Arial, sans-serif; color: #ffffff;">
                                                  <h1 style="margin: 0; font-size: 24px; line-height: 1.25; font-weight: 700; display: inline;">${parts.title}</h1>${statusChip}
                                             </td>
                                        </tr>
                                   </table>
                              </td>
                         </tr>

                         <!-- Intro -->
                         <tr>
                              <td class="pls-pad" style="padding: 24px 28px 8px 28px; font-family: Segoe UI, Tahoma, Arial, sans-serif;">
                                   <p style="margin: 0 0 8px 0; font-size: 15px; color: #0f172a;">Dear {{supplier_name}},</p>
                                   <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #475569;">${parts.intro}</p>
                              </td>
                         </tr>

                         <!-- Parties -->
                         <tr>
                              <td class="pls-pad" style="padding: 18px 20px 8px 20px; font-family: Segoe UI, Tahoma, Arial, sans-serif;">
                                   <table role="presentation" class="pls-stack" width="100%" cellspacing="0" cellpadding="0">
                                        <tr>
                                             ${fromBlock}
                                             ${toBlock}
                                        </tr>
                                   </table>
                              </td>
                         </tr>

                         <!-- Meta -->
                         <tr>
                              <td class="pls-pad" style="padding: 12px 20px 8px 20px; font-family: Segoe UI, Tahoma, Arial, sans-serif;">
                                   <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                                        <tr>
                                             <td width="50%" valign="top" style="padding: 14px 16px;">
                                                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${leftMeta}</table>
                                             </td>
                                             <td width="50%" valign="top" style="padding: 14px 16px; border-left: 1px solid #e2e8f0;">
                                                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rightMeta}</table>
                                             </td>
                                        </tr>
                                   </table>
                              </td>
                         </tr>

                         <!-- Line items -->
                         <tr>
                              <td class="pls-pad" style="padding: 20px 28px 8px 28px; font-family: Segoe UI, Tahoma, Arial, sans-serif;">
                                   <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 10px 0;">
                                        <tr>
                                             <td style="font-size: 12px; font-weight: 700; letter-spacing: 0.7px; text-transform: uppercase; color: #0f172a;">${parts.itemsSectionTitle}</td>
                                             <td align="right" style="font-size: 11px; color: #64748b;">All amounts in {{currency_code}}</td>
                                        </tr>
                                   </table>
                                   <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);">
                                        <thead>
                                             <tr>
                                                  ${buildItemsTableHeader(parts.itemColumns)}
                                             </tr>
                                        </thead>
                                        <tbody>
                                             ${parts.itemsRowsHtmlToken}
                                        </tbody>
                                   </table>
                              </td>
                         </tr>

                         <!-- Totals -->
                         <tr>
                              <td class="pls-pad" style="padding: 12px 28px 12px 28px; font-family: Segoe UI, Tahoma, Arial, sans-serif;">
                                   <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                        <tr>
                                             <td width="42%"></td>
                                             <td width="58%">
                                                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius: 10px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);">
                                                       <tr>
                                                            <td colspan="2" style="padding: 10px 16px; font-size: 11px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: #64748b; background: #f1f5f9; border-bottom: 1px solid #e2e8f0;">Summary</td>
                                                       </tr>
                                                       ${totalsHtml}
                                                  </table>
                                             </td>
                                        </tr>
                                   </table>
                              </td>
                         </tr>

                         ${notesBlock}

                         <!-- Reference strip -->
                         <tr>
                              <td class="pls-pad" style="padding: 4px 28px 18px 28px; font-family: Segoe UI, Tahoma, Arial, sans-serif;">
                                   <p style="margin: 0; font-size: 11px; line-height: 1.6; color: #94a3b8;">
                                        Document ref · Event <strong style="color: #64748b;">{{event_code}}</strong> · {{triggered_at}}
                                   </p>
                              </td>
                         </tr>

                         <!-- Footer -->
                         <tr>
                              <td style="background: #f8fafc; border-top: 1px solid #e2e8f0;">
                                   <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                        <tr>
                                             <td class="pls-pad" style="padding: 16px 28px 20px 28px; font-family: Segoe UI, Tahoma, Arial, sans-serif; color: #64748b;">
                                                  ${footerExtra}
                                                  <p style="margin: 0 0 6px 0; font-size: 12px; line-height: 1.6;">This is an official procurement communication from {{laboratory_name}}.</p>
                                                  <p style="margin: 0 0 6px 0; font-size: 12px; line-height: 1.6;">{{branch_name}} · {{branch_address}}</p>
                                                  <p style="margin: 0; font-size: 12px; line-height: 1.6;">{{branch_phone}} · {{branch_email}} · {{laboratory_website}}</p>
                                             </td>
                                        </tr>
                                   </table>
                              </td>
                         </tr>
                    </table>
               </td>
          </tr>
     </table>
</body>
</html>`.trim();
}

export function buildInvoiceDocumentPlain(parts: InvoiceDocumentParts): string {
     const left = parts.metaLeft.map((m) => `${m.label}: ${m.value}`).join('\n');
     const right = parts.metaRight.map((m) => `${m.label}: ${m.value}`).join('\n');
     const party = parts.partyLines.join('\n');
     const totals = parts.totals.map((t) => `${t.label}: ${t.value}`).join('\n');

     return [
          `${parts.documentLabel}: ${parts.title}`,
          `${parts.documentNumberLabel}: ${parts.documentNumberValue}`,
          parts.statusLabel ? `Status: ${parts.statusLabel}` : '',
          '',
          `Dear {{supplier_name}},`,
          parts.intro,
          '',
          parts.partyTitle.toUpperCase(),
          party,
          '',
          'DOCUMENT DETAILS',
          left,
          right,
          '',
          parts.itemsSectionTitle.toUpperCase(),
          parts.itemsTextToken,
          '',
          'TOTALS',
          totals,
          parts.notes ? `\nNotes:\n${parts.notes}` : '',
          '',
          'Event Code: {{event_code}}',
          'Event Time: {{triggered_at}}',
          '',
          '{{laboratory_name}} | {{branch_name}} | {{branch_phone}} | {{branch_email}}',
          parts.footerNote || 'This is an official procurement communication.',
     ]
          .filter((line) => line !== undefined)
          .join('\n');
}

/** Shared PO line columns */
const PO_ITEM_COLUMNS = ['#', 'Item', 'SKU', 'Quantity', 'Unit Price', 'Total Price'];
const RECEIVED_ITEM_COLUMNS = ['#', 'Item', 'SKU', 'Qty Ordered', 'Qty Received', 'Unit Price', 'Total Price'];
const PAYMENT_ITEM_COLUMNS = ['#', 'Description / PO', 'Reference', 'Amount'];

export function buildPurchaseOrderInvoiceParts(
     subject: string,
     title: string,
     intro: string,
     options?: { receivedMode?: boolean; statusFromVar?: boolean },
): InvoiceDocumentParts {
     const received = Boolean(options?.receivedMode);
     return {
          subject,
          documentLabel: received ? 'GOODS RECEIPT NOTICE' : 'PURCHASE ORDER',
          title,
          intro,
          statusLabel: options?.statusFromVar === false ? undefined : '{{purchase_order_status}}',
          documentNumberLabel: 'Order No.',
          documentNumberValue: '{{order_number}}',
          metaLeft: [
               { label: 'PO ID', value: '{{purchase_order_id}}' },
               { label: 'Order Date', value: '{{order_date}}' },
               { label: 'Expected Delivery', value: '{{expected_delivery_date}}' },
          ],
          metaRight: [
               { label: 'Status', value: '{{purchase_order_status}}' },
               { label: 'Line Items', value: '{{purchase_order_items_count}}' },
               { label: 'Currency', value: '{{currency_code}}' },
          ],
          partyTitle: 'Supplier',
          partyLines: [
               '<strong>{{supplier_name}}</strong>',
               '{{supplier_contact}}',
               '{{supplier_email}}',
               '{{supplier_phone}}',
          ],
          billFromTitle: 'Bill From / Ship To',
          includeLabAsFrom: true,
          itemsSectionTitle: received ? 'Items Received' : 'Order Items',
          itemsRowsHtmlToken: received
               ? '{{purchase_order_received_items_html}}'
               : '{{purchase_order_items_html}}',
          itemColumns: received ? RECEIVED_ITEM_COLUMNS : PO_ITEM_COLUMNS,
          itemsTextToken: received
               ? '{{purchase_order_received_items_text}}'
               : '{{purchase_order_items_text}}',
          totals: [
               { label: 'Subtotal', value: '{{purchase_order_subtotal}}' },
               { label: 'Tax', value: '{{purchase_order_tax}}' },
               { label: 'Order Total', value: '{{purchase_order_total_formatted}}', emphasize: true },
          ],
          notes: received
               ? 'Please retain this notice as confirmation that goods have been recorded against the purchase order. Contact us if quantities differ from your delivery note.'
               : 'Please confirm item availability, unit pricing, and expected shipment date. Quote the order number on all invoices and delivery notes.',
          footerNote: 'Thank you for partnering with us. We look forward to your prompt fulfillment.',
     };
}

export function buildSupplierPaymentInvoiceParts(
     subject: string,
     title: string,
     intro: string,
): InvoiceDocumentParts {
     return {
          subject,
          documentLabel: 'PAYMENT ADVICE',
          title,
          intro,
          statusLabel: '{{payment_status}}',
          documentNumberLabel: 'Payment Ref.',
          documentNumberValue: '{{payment_id}}',
          metaLeft: [
               { label: 'Payment Date', value: '{{payment_date}}' },
               { label: 'Method', value: '{{payment_method}}' },
               { label: 'Reference No.', value: '{{payment_reference_number}}' },
          ],
          metaRight: [
               { label: 'Linked PO', value: '{{order_number}}' },
               { label: 'PO Total', value: '{{purchase_order_total_formatted}}' },
               { label: 'Allocated', value: '{{payment_total_allocated_formatted}}' },
          ],
          partyTitle: 'Payee (Supplier)',
          partyLines: [
               '<strong>{{supplier_name}}</strong>',
               '{{supplier_contact}}',
               '{{supplier_email}}',
               '{{supplier_phone}}',
          ],
          billFromTitle: 'Payer',
          includeLabAsFrom: true,
          itemsSectionTitle: 'Payment Breakdown',
          itemsRowsHtmlToken: '{{supplier_payment_items_html}}',
          itemColumns: PAYMENT_ITEM_COLUMNS,
          itemsTextToken: '{{supplier_payment_items_text}}',
          totals: [
               { label: 'Amount Paid', value: '{{payment_amount_formatted}}', emphasize: true },
          ],
          notes: 'Payment Notes: {{payment_notes}}',
          footerNote: 'This payment advice confirms funds processed to the supplier account. Keep this document for audit and reconciliation.',
     };
}
