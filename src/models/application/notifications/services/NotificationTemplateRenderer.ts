export class NotificationTemplateRenderer {
     render(subject: string, htmlBody: string, plainBody: string, variables: Record<string, unknown>) {
          const replacer = (input: string) => input.replace(/{{\s*([A-Za-z0-9_]+)\s*}}/g, (_: string, key: string) => {
               const value = variables[key];
               return value === undefined || value === null ? '' : String(value);
          });

          return {
               subject: replacer(subject || ''),
               htmlBody: replacer(htmlBody || ''),
               plainBody: replacer(plainBody || ''),
          };
     }
}
