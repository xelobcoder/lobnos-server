"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.killProcessOnPort = void 0;
const child_process_1 = require("child_process");
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
            var _a, _b, _c;
            if (err) {
                reject({ err, stderr: (_a = stderr === null || stderr === void 0 ? void 0 : stderr.toString()) !== null && _a !== void 0 ? _a : '' });
                return;
            }
            resolve({ stdout: (_b = stdout === null || stdout === void 0 ? void 0 : stdout.toString()) !== null && _b !== void 0 ? _b : '', stderr: (_c = stderr === null || stderr === void 0 ? void 0 : stderr.toString()) !== null && _c !== void 0 ? _c : '' });
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
        catch (_a) {
            // Fall back to netstat if PowerShell is unavailable.
        }
        try {
            const { stdout } = await execFilePromise('cmd.exe', ['/c', `netstat -ano | findstr :${port}`]);
            return parsePidsFromNetstat(stdout, port);
        }
        catch (error) {
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
    catch (_b) {
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
                console.error(`Port ${port} may be owned by a higher-privilege process or service. Run as Administrator or stop the owning service.`);
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
