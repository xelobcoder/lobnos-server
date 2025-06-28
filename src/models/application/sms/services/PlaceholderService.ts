export class PlaceholderService {
     process(template: string, data: Record<string, any>): string {
          return template.replace(/{{(\w+)}}/g, (_, key) => data[key] ?? '');
     }
}
