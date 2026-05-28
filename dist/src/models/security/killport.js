"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.killProcessOnPort = void 0;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const parsePidsFromPowerShell = (stdout) => {
    return stdout
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(Number)
        .filter(pid => Number.isInteger(pid) && pid > 0);
};
const isValidPid = (pid) => pid !== null && Number.isInteger(pid) && pid > 0;
const parsePidsFromNetstat = (stdout, port) => {
    return Array.from(new Set(stdout
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
        const parts = line.split(/\s+/);
        const localEndpoint = parts[1] || '';
        if (!localEndpoint.endsWith(`:${port}`) && !localEndpoint.endsWith(`.${port}`)) {
            return null;
        }
        const pid = parts[parts.length - 1];
        return pid && pid !== '0' ? Number(pid) : null;
    })
        .filter(isValidPid)));
};
const execFilePromise = (file, args) => {
    return new Promise((resolve, reject) => {
        (0, child_process_1.execFile)(file, args, { windowsHide: true }, (err, stdout, stderr) => {
            var _a, _b;
            const out = (_a = stdout === null || stdout === void 0 ? void 0 : stdout.toString()) !== null && _a !== void 0 ? _a : '';
            const errOut = (_b = stderr === null || stderr === void 0 ? void 0 : stderr.toString()) !== null && _b !== void 0 ? _b : '';
            if (err) {
                reject({ err, stdout: out, stderr: errOut });
                return;
            }
            resolve({ stdout: out, stderr: errOut });
        });
    });
};
const getPidsOnPort = async (port) => {
    if (process.platform === 'win32') {
        const psCommand = `Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique`;
        try {
            const { stdout } = await execFilePromise('powershell.exe', ['-NoProfile', '-Command', psCommand]);
            const pids = parsePidsFromPowerShell(stdout);
            if (pids.length > 0)
                return pids;
        }
        catch (error) {
            // PowerShell might fail if the command returns nothing or if PS is restricted.
            // We fall back to netstat.
        }
        try {
            const { stdout } = await execFilePromise('cmd.exe', ['/c', `netstat -ano | findstr :${port}`]);
            return parsePidsFromNetstat(stdout, port);
        }
        catch (error) {
            const err = error === null || error === void 0 ? void 0 : error.err;
            // findstr returns exit code 1 if no matches are found, which is not an error for us.
            if (err && err.code === 1) {
                return [];
            }
            const stderr = error === null || error === void 0 ? void 0 : error.stderr;
            console.error(`Error querying port ${port} with netstat: ${stderr || error}`);
            return [];
        }
    }
    try {
        const { stdout } = await execFilePromise('lsof', ['-i', `TCP:${port}`, '-sTCP:LISTEN', '-t']);
        return stdout
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean)
            .map(Number)
            .filter(pid => Number.isInteger(pid) && pid > 0);
    }
    catch (error) {
        // lsof returns exit code 1 if no matches are found.
        if (error.err && error.err.code === 1) {
            return [];
        }
        return [];
    }
};
const killPids = async (pids, port) => {
    var _a;
    if (pids.length === 0) {
        console.log(`No process running on port ${port}`);
        return;
    }
    if (process.platform === 'win32') {
        // Try to use our specialized PowerShell script first as it handles elevation
        const scriptPath = path_1.default.join(process.cwd(), 'scripts', 'kill-port.ps1');
        if (fs_1.default.existsSync(scriptPath)) {
            console.log(`Attempting to kill port ${port} using administrative PowerShell script...`);
            return new Promise((resolve) => {
                const child = (0, child_process_1.spawn)('powershell.exe', [
                    '-NoProfile',
                    '-ExecutionPolicy', 'Bypass',
                    '-File', scriptPath,
                    '-Port', port.toString(),
                    '-Silent'
                ], { stdio: 'inherit', windowsHide: true });
                child.on('close', (code) => {
                    if (code === 0) {
                        console.log(`PowerShell script finished successfully.`);
                    }
                    else {
                        console.error(`PowerShell script exited with code ${code}`);
                    }
                    resolve();
                });
            });
        }
        // Fallback to taskkill if script is missing
        const args = ['/F', '/T', ...pids.flatMap(pid => ['/PID', pid.toString()])];
        try {
            const { stdout, stderr } = await execFilePromise('taskkill', args);
            if (stderr) {
                console.error(`taskkill warnings/errors: ${stderr}`);
            }
            console.log(`Killed port ${port} processes: ${pids.join(', ')}`);
            if (stdout)
                console.log(stdout);
        }
        catch (error) {
            const stderr = (_a = error === null || error === void 0 ? void 0 : error.stderr) !== null && _a !== void 0 ? _a : String(error);
            console.error(`Error killing processes on port ${port}: ${stderr}`);
            if (stderr.toLowerCase().includes('access is denied')) {
                console.error(`Access Denied: Port ${port} is owned by a high-privilege process. Please run this command as Administrator.`);
            }
        }
        return;
    }
    await Promise.all(pids.map(pid => execFilePromise('kill', ['-9', pid.toString()]).catch(error => {
        console.error(`Failed to kill PID ${pid} on port ${port}:`, error);
    })));
};
const killProcessOnPort = async (port) => {
    if (!Number.isInteger(port) || port <= 0) {
        console.error(`Invalid port number: ${port}`);
        return;
    }
    const pids = await getPidsOnPort(port);
    await killPids(pids, port);
};
exports.killProcessOnPort = killProcessOnPort;
const resolvePort = () => {
    const argvPort = process.argv[2] ? parseInt(process.argv[2], 10) : NaN;
    if (!isNaN(argvPort) && argvPort > 0)
        return argvPort;
    const envPortRaw = process.env.DEVELOPMENT_PORT || process.env.PORT;
    const envPort = envPortRaw ? parseInt(envPortRaw, 10) : NaN;
    if (!isNaN(envPort) && envPort > 0)
        return envPort;
    return 2399;
};
if (require.main === module) {
    const port = resolvePort();
    (0, exports.killProcessOnPort)(port)
        .then(() => process.exit(0))
        .catch(() => process.exit(0));
}
