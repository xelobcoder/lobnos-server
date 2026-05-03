"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.killProcessOnPort = void 0;
const child_process_1 = require("child_process");
const killProcessOnPort = (port) => {
    return new Promise((resolve) => {
        (0, child_process_1.exec)(`netstat -aon | findstr :${port}`, (err, stdout, stderr) => {
            if (err || stderr) {
                console.error(`Error executing netstat: ${err || stderr}`);
                resolve();
                return;
            }
            const lines = stdout.trim().split('\n');
            if (lines.length === 0) {
                console.log(`No process running on port ${port}`);
                resolve();
                return;
            }
            const pids = Array.from(new Set(lines
                .map(line => {
                const parts = line.trim().split(/\s+/);
                return parts[parts.length - 1];
            })
                .filter(pid => pid && pid !== '0')));
            if (pids.length === 0) {
                console.log(`No killable process found on port ${port}`);
                resolve();
                return;
            }
            let pending = pids.length;
            pids.forEach(pid => {
                console.log(`Killing process ${pid} running on port ${port}`);
                (0, child_process_1.exec)(`taskkill /F /T /PID ${pid}`, (killErr, killStdout, killStderr) => {
                    if (killErr || killStderr) {
                        const msg = String(killErr || killStderr);
                        console.error(`Error killing process ${pid}: ${msg}`);
                        if (msg.toLowerCase().includes('access is denied')) {
                            console.error(`Port ${port} is owned by a process running with higher privileges (often a Windows service). Run the terminal as Administrator or stop the owning service, then retry.`);
                        }
                    }
                    else {
                        console.log(`Process ${pid} killed successfully: ${killStdout}`);
                    }
                    pending--;
                    if (pending === 0)
                        resolve();
                });
            });
        });
    });
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
    return 6000;
};
if (require.main === module) {
    const port = resolvePort();
    (0, exports.killProcessOnPort)(port)
        .then(() => process.exit(0))
        .catch(() => process.exit(0));
}
