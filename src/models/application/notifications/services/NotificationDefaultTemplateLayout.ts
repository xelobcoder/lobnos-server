export type TemplateParts = {
     subject: string;
     title: string;
     intro: string;
     details: string[];
     actionText?: string;
     actionValue?: string;
};

function renderDetailLine(line: string): string {
     if (!line.includes('\n')) {
          return `<li style="margin: 0 0 8px 0;">${line}</li>`;
     }

     const [headline, ...rest] = line.split('\n');
     const body = rest.join('<br />');

     return `
          <li style="margin: 0 0 12px 0;">
               <div style="font-weight: 600; color: #0f172a; margin: 0 0 6px 0;">${headline}</div>
               <div style="white-space: normal; line-height: 1.7; color: #334155;">${body}</div>
          </li>`;
}

export function buildEnterpriseHtml(parts: TemplateParts): string {
     const detailsHtml = parts.details
          .map((line) => renderDetailLine(line))
          .join('');

     const actionBlock = parts.actionText && parts.actionValue
          ? `
               <tr>
                    <td style="padding: 0 28px 18px 28px;">
                         <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: separate; border-spacing: 0;">
                              <tr>
                                   <td style="background: #eaf2ff; border: 1px solid #c9ddff; border-radius: 6px; padding: 14px 16px;">
                                        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #0f172a;">
                                             <strong>${parts.actionText}:</strong> ${parts.actionValue}
                                        </p>
                                   </td>
                              </tr>
                         </table>
                    </td>
               </tr>`
          : '';

     return `
<!DOCTYPE html>
<html lang="en">
<head>
     <meta charset="UTF-8" />
     <meta name="viewport" content="width=device-width, initial-scale=1.0" />
     <meta http-equiv="X-UA-Compatible" content="IE=edge" />
     <title>${parts.title}</title>
     <style>
          body { margin: 0; padding: 0; background: #edf2f7; }
          table { border-collapse: collapse; }
          img { border: 0; outline: none; text-decoration: none; display: block; }
          @media only screen and (max-width: 640px) {
               .pls-shell { width: 100% !important; }
               .pls-pad { padding-left: 16px !important; padding-right: 16px !important; }
               .pls-title { font-size: 22px !important; }
          }
     </style>
</head>
<body>
     <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width: 100%; background: #edf2f7; padding: 20px 8px;">
          <tr>
               <td align="center">
                    <table role="presentation" class="pls-shell" width="760" cellspacing="0" cellpadding="0" style="width: 760px; max-width: 760px; background: #ffffff; border: 1px solid #d9e2ec; border-radius: 0px; overflow: hidden;">
                         <tr>
                              <td>
                                   <header>
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #0b3a6e;">
                                             <tr>
                                                  <td class="pls-pad" style="padding: 22px 28px; color: #ffffff;">
                                                       <p style="margin: 0 0 6px 0; font-size: 12px; letter-spacing: 0.8px; font-weight: 600; opacity: 0.95;">{{laboratory_name}}</p>
                                                       <h1 class="pls-title" style="margin: 0; font-size: 26px; line-height: 1.3; font-weight: 700;">${parts.title}</h1>
                                                  </td>
                                             </tr>
                                        </table>
                                   </header>
                              </td>
                         </tr>

                         <tr>
                              <td>
                                   <main>
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                             <tr>
                                                  <td class="pls-pad" style="padding: 26px 28px 12px 28px; font-family: Segoe UI, Tahoma, Arial, sans-serif; color: #111827;">
                                                       <p style="margin: 0 0 12px 0; font-size: 15px; line-height: 1.65;">Hello,</p>
                                                       <p style="margin: 0; font-size: 14px; line-height: 1.75; color: #374151;">${parts.intro}</p>
                                                  </td>
                                             </tr>

                                             <tr>
                                                  <td class="pls-pad" style="padding: 10px 28px 10px 28px;">
                                                       <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px;">
                                                            <tr>
                                                                 <td style="padding: 16px 18px; font-family: Segoe UI, Tahoma, Arial, sans-serif; color: #111827;">
                                                                      <h2 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Event Details</h2>
                                                                      <ul style="margin: 0; padding-left: 18px; font-size: 14px; line-height: 1.65; color: #111827; list-style: disc;">
                                                                           ${detailsHtml}
                                                                      </ul>
                                                                 </td>
                                                            </tr>
                                                       </table>
                                                  </td>
                                             </tr>

                                             ${actionBlock}

                                             <tr>
                                                  <td class="pls-pad" style="padding: 10px 28px 18px 28px; font-family: Segoe UI, Tahoma, Arial, sans-serif;">
                                                       <p style="margin: 0; font-size: 12px; line-height: 1.7; color: #6b7280;">
                                                         
                                                            Triggered At: {{triggered_at}}
                                                       </p>
                                                  </td>
                                             </tr>
                                        </table>
                                   </main>
                              </td>
                         </tr>

                         <tr>
                              <td>
                                   <footer>
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f9fafb; border-top: 1px solid #e5e7eb;">
                                             <tr>
                                                  <td class="pls-pad" style="padding: 16px 28px 20px 28px; font-family: Segoe UI, Tahoma, Arial, sans-serif; color: #4b5563;">
                                                       <p style="margin: 0 0 8px 0; font-size: 12px; line-height: 1.65;">This is a system-generated communication from {{laboratory_name}}.</p>
                                                       <p style="margin: 0 0 8px 0; font-size: 12px; line-height: 1.65;">Branch: {{branch_name}} | {{branch_address}}</p>
                                                       <p style="margin: 0 0 8px 0; font-size: 12px; line-height: 1.65;">Contact: {{branch_phone}} | {{branch_email}}</p>
                                                       <p style="margin: 0; font-size: 12px; line-height: 1.65;">Laboratory Contact: {{laboratory_phone}} | {{laboratory_email}} | {{laboratory_website}}</p>
                                                  </td>
                                             </tr>
                                        </table>
                                   </footer>
                              </td>
                         </tr>
                    </table>
               </td>
          </tr>
     </table>
</body>
</html>`.trim();
}

export function buildEnterprisePlain(parts: TemplateParts): string {
     const detailLines = parts.details.map((line) => `- ${line}`).join('\n');
     const actionLine = parts.actionText && parts.actionValue
          ? `\n${parts.actionText}: ${parts.actionValue}`
          : '';

     return [
          `LABORATORY NOTIFICATION: ${parts.title}`,
          '',
          'Hello,',
          parts.intro,
          '',
          'Details:',
          detailLines,
          actionLine,
          '',
          'Event Code: {{event_code}}',
          'Event Time: {{triggered_at}}',
          '',
          'Branch: {{branch_name}} | {{branch_address}}',
          'Branch Contact: {{branch_phone}} | {{branch_email}}',
          'Laboratory Contact: {{laboratory_name}} | {{laboratory_phone}} | {{laboratory_email}} | {{laboratory_website}}',
          '',
          'This is a system-generated laboratory message.',
     ].join('\n');
}
