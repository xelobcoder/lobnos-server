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

            let pending = lines.length;
            lines.forEach(line => {
                const parts = line.trim().split(/\s+/);
                const pid = parts[parts.length - 1];

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

const port = process.env.NODE_ENV == 'development' ? process.env.DEVELOPMENT_PORT : process.env.PRODUCTION_PORT || 5000;

killProcessOnPort(Number(port));