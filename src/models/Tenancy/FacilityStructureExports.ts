import fs from 'fs';
import path from 'path';

export const EXPORTED_SOURCE_DATABASE = 'primelabtestmig';
export interface FacilityStructure {
     tables: Array<{ name: string; ddl: string }>;
     objects: Array<{ name: string; kind: 'TRIGGER' | 'PROCEDURE' | 'FUNCTION'; ddl: string }>;
}

/** Parse mysqldump delimiters without splitting semicolons inside strings or stored-program bodies. */
export function exportedSqlStatements(sql: string): string[] {
     const text = sql.replace(/\/\*!\d+\s?([\s\S]*?)\*\//g, '$1');
     const statements: string[] = [];
     let delimiter = ';';
     let buffer = '';
     let quote = '';
     for (let index = 0; index < text.length;) {
          if (!quote && (index === 0 || text[index - 1] === '\n')) {
               const directive = text.slice(index).match(/^[ \t]*DELIMITER[ \t]+(\S+)[ \t]*(?:\r?\n|$)/i);
               if (directive) {
                    if (buffer.trim()) throw new Error('Unexpected SQL before delimiter directive');
                    delimiter = directive[1];
                    index += directive[0].length;
                    continue;
               }
          }
          const char = text[index];
          if (quote) {
               buffer += char;
               index++;
               if (char === '\\' && quote !== '`' && index < text.length) buffer += text[index++];
               else if (char === quote) {
                    if (text[index] === quote) buffer += text[index++];
                    else quote = '';
               }
               continue;
          }
          if (char === "'" || char === '"' || char === '`') {
               quote = char;
               buffer += char;
               index++;
               continue;
          }
          if ((text.startsWith('--', index) && /\s/.test(text[index + 2] || ' '))
               || char === '#') {
               const end = text.indexOf('\n', index);
               index = end === -1 ? text.length : end;
               buffer += ' ';
               continue;
          }
          if (text.startsWith('/*', index)) {
               const end = text.indexOf('*/', index + 2);
               if (end === -1) throw new Error('Unterminated export comment');
               index = end + 2;
               buffer += ' ';
               continue;
          }
          if (text.startsWith(delimiter, index)) {
               if (buffer.trim()) statements.push(buffer.trim());
               buffer = '';
               index += delimiter.length;
               continue;
          }
          buffer += char;
          index++;
     }
     if (quote || buffer.trim()) throw new Error('Unterminated exported SQL statement');
     return statements;
}

/** Only schema CREATE statements are executable. Dump resets/session commands and any DML are not. */
export function structureFromExports(files: Array<{ filename: string; sql: string }>): FacilityStructure {
     const tables: FacilityStructure['tables'] = [];
     const objects: FacilityStructure['objects'] = [];
     const keys = new Set<string>();
     for (const file of files) {
          let tableCount = 0;
          for (const statement of exportedSqlStatements(file.sql)) {
               if (/^SET\s/i.test(statement) || /^DROP (?:TABLE|PROCEDURE|FUNCTION|TRIGGER) IF EXISTS `/i.test(statement)) continue;
               const ddl = statement.replace(/DEFINER\s*=\s*`[^`]*`@`[^`]*`\s*/gi, '');
               const match = ddl.match(/^CREATE\s+(TABLE|TRIGGER|PROCEDURE|FUNCTION)\s+`([A-Za-z][A-Za-z0-9_]*)`/i);
               if (!match) throw new Error('Export contains a non-schema or unsupported statement');
               const kind = match[1].toUpperCase();
               const name = match[2];
               const key = `${kind}:${name}`;
               if (keys.has(key)) throw new Error('Duplicate exported schema object');
               keys.add(key);
               if (kind === 'TABLE') {
                    if (file.filename !== `primelabtestmig_${name}.sql`) throw new Error('Export table does not match filename');
                    tableCount++;
                    tables.push({ name, ddl });
               } else {
                    objects.push({ name, kind: kind as FacilityStructure['objects'][number]['kind'], ddl });
               }
          }
          if (file.filename === 'primelabtestmig_routines.sql' ? tableCount !== 0 : tableCount !== 1) {
               throw new Error('Export file must contain its expected table structure');
          }
     }
     if (!tables.length || !objects.some(object => object.kind === 'PROCEDURE')) throw new Error('Incomplete facility structure exports');
     return { tables, objects };
}

export function loadFacilityStructureExports(): FacilityStructure {
     const directory = [
          path.resolve(__dirname, '../../../db-exports/primelabmaster/tables-structure'),
          path.resolve(__dirname, '../../../../db-exports/primelabmaster/tables-structure'),
     ].find(candidate => fs.existsSync(path.join(candidate, 'primelabtestmig_roles.sql')));
     if (!directory) throw new Error('Required facility structure assets are missing');
     const files = fs.readdirSync(directory).filter(filename => filename.endsWith('.sql')).sort();
     if (!files.includes('primelabtestmig_routines.sql')) throw new Error('Required facility routines export is missing');
     const structure = structureFromExports(files.map(filename => ({
          filename, sql: fs.readFileSync(path.join(directory, filename), 'utf8'),
     })));
     // This is the supplied authoritative snapshot, not a best-effort partial migration set.
     if (files.length !== 288 || structure.tables.length !== 287
          || structure.objects.filter(object => object.kind === 'TRIGGER').length !== 71
          || structure.objects.filter(object => object.kind === 'PROCEDURE').length !== 36) {
          throw new Error('Authoritative structure export set is incomplete or requires review');
     }
     return structure;
}
