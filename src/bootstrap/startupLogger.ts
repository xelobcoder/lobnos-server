import os from 'os';

export function logApplicationStarted(port: string | number | undefined): void {
     const pid = process.pid;

     const timestamp = new Date().toLocaleString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
     });

     const localUrl = `http://localhost:${port}`;
     const networkUrl = `http://${os.hostname()}:${port}`;

     console.log(
          `\x1b[32m[PrimeLabSys]\x1b[0m ${pid}  - ${timestamp}     \x1b[32mLOG\x1b[0m \x1b[38;5;39m[Bootstrap]\x1b[0m Application successfully started`
     );

     console.log(
          `\x1b[32m[PrimeLabSys]\x1b[0m ${pid}  - ${timestamp}     \x1b[32mLOG\x1b[0m \x1b[38;5;39m[Bootstrap]\x1b[0m Environment : ${process.env.NODE_ENV ?? 'development'}`
     );

     console.log(
          `\x1b[32m[PrimeLabSys]\x1b[0m ${pid}  - ${timestamp}     \x1b[32mLOG\x1b[0m \x1b[38;5;39m[Bootstrap]\x1b[0m Port        : ${port}`
     );

     console.log(
          `\x1b[32m[PrimeLabSys]\x1b[0m ${pid}  - ${timestamp}     \x1b[32mLOG\x1b[0m \x1b[38;5;39m[Bootstrap]\x1b[0m Local       : ${localUrl}`
     );

     console.log(
          `\x1b[32m[PrimeLabSys]\x1b[0m ${pid}  - ${timestamp}     \x1b[32mLOG\x1b[0m \x1b[38;5;39m[Bootstrap]\x1b[0m Network     : ${networkUrl}`
     );
}