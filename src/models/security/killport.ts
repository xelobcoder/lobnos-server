import { exec } from 'child_process';


export const killProcessOnPort = (port: number): void => {
    exec(`netstat -aon | findstr :${port}`, (err, stdout, stderr) => {
        if (err || stderr) {
            console.error(`Error executing netstat: ${err || stderr}`);
            return;
        }

        const lines = stdout.trim().split('\n');
        if (lines.length === 0) {
            console.log(`No process running on port ${port}`);
            return;
        }

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
            });
        });
    });
};


killProcessOnPort(8000)
