export type MasterOwnerInitMode = 'prompt' | 'password-stdin' | 'import-staff';

export interface MasterOwnerInitArguments {
     username: string;
     mode: MasterOwnerInitMode;
     tenantId?: string;
     employeeId?: string;
}

const USAGE = 'Usage: master:init [--password-stdin] | [username] --password-stdin | [--import-staff <tenantId> <employeeId>]';

export function parseMasterOwnerInitArguments(args: string[]): MasterOwnerInitArguments {
     if (args[0] === '--') return parseMasterOwnerInitArguments(args.slice(1));
     if (args.length === 0) return { username: 'plsmaster', mode: 'prompt' };

     const [first, second, third, fourth] = args;
     if (first === '--password-stdin' && args.length === 1) {
          return { username: 'plsmaster', mode: 'password-stdin' };
     }
     if (first === '--import-staff' && args.length === 3) {
          return { username: 'plsmaster', mode: 'import-staff', tenantId: second, employeeId: third };
     }

     const username = first.toLowerCase();
     if (!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(username)) throw new Error(USAGE);
     if (second === '--password-stdin' && args.length === 2) {
          return { username, mode: 'password-stdin' };
     }
     if (second === '--import-staff' && args.length === 4) {
          return { username, mode: 'import-staff', tenantId: third, employeeId: fourth };
     }
     throw new Error(USAGE);
}
