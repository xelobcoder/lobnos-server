import { RenderedEmailTemplate } from '../types/EmailModels';

function replaceTokens(input: string, variables: Record<string, unknown>): string {
     return input.replace(/{{\s*([A-Za-z0-9_]+)\s*}}/g, (_, key: string) => {
          const value = variables[key];
          return value === undefined || value === null ? '' : String(value);
     });
}

export class TemplateRenderer {
     render(subject: string, htmlBody: string, plainTextBody: string, variables: Record<string, unknown>): RenderedEmailTemplate {
          return {
               subject: replaceTokens(subject, variables),
               htmlBody: replaceTokens(htmlBody, variables),
               plainTextBody: replaceTokens(plainTextBody, variables),
          };
     }
}
