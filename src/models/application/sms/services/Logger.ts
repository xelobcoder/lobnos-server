import fs from 'fs';
import path from 'path';

const LOG_FILE = process.env.SMS_LOG_FILE || path.join(__dirname, '../../../../errorlogs.txt');
const LOG_LEVEL = process.env.SMS_LOG_LEVEL || 'error'; // 'error', 'info', 'silent'

function logToFile(message: string) {
     try {
          fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${message}\n`);
     } catch (e) {
          // Fallback: do nothing
     }
}

export const Logger = {
     error: (msg: string, err?: any) => {
          if (LOG_LEVEL === 'silent') return;
          const errorMsg = err ? `${msg} ${err instanceof Error ? err.stack : JSON.stringify(err)}` : msg;
          logToFile(errorMsg);
     },
     info: (msg: string) => {
          if (LOG_LEVEL !== 'info') return;
          logToFile(msg);
     }
};
