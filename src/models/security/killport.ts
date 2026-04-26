import { exec } from 'child_process';

export const killProcessOnPort = (port: number): Promise<void> => {
    return new Promise((resolve) => {
        exec(`netstat -aon | findstr :${port}`, (err, stdout, stderr) => {
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

            const pids = Array.from(new Set(
                lines
                    .map(line => {
                        const parts = line.trim().split(/\s+/);
                        return parts[parts.length - 1];
                    })
                    .filter(pid => pid && pid !== '0')
            ));

            if (pids.length === 0) {
                console.log(`No killable process found on port ${port}`);
                resolve();
                return;
            }

            let pending = pids.length;
            pids.forEach(pid => {
                console.log(`Killing process ${pid} running on port ${port}`);
                exec(`taskkill /F /PID ${pid}`, (killErr, killStdout, killStderr) => {
                    if (killErr || killStderr) {
                        console.error(`Error killing process ${pid}: ${killErr || killStderr}`);
                    } else {
                        console.log(`Process ${pid} killed successfully: ${killStdout}`);
                    }
                    pending--;
                    if (pending === 0) resolve();
                });
            });
        });
    });
};
