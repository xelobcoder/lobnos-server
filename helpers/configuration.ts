import cluster from 'cluster';
import os from 'os';
import { Request, Response, NextFunction } from 'express';

interface Configurations {
  hasInventorySubscribed: number;
  strictBranchCheck: number;
  multipleBranchesEnabled: number;
  hasPurchaseManagement: number;
}

interface Configuration {
  possibleWorkers: number;
  fork: () => void;
  logRequest: (request: Request, response: Response, next: NextFunction) => Promise<void>;
  configurations: Configurations;
}

const configuration: Configuration = {
  possibleWorkers: os.cpus().length,
  fork: function(): void {
    for (let i = 0; i < this.possibleWorkers; i++) {
      cluster.fork();
    }
  },
  logRequest: async function(request: Request, response: Response, next: NextFunction): Promise<void> {
    next();
    const origin = request.headers.origin;
    console.log(`${new Date()} referer: ${origin} ${request.method} ${request.baseUrl} ${request.url.split("?")[0]}`);
  },
  configurations: {
    hasInventorySubscribed: 0,
    strictBranchCheck: 1,
    multipleBranchesEnabled: 1,
    hasPurchaseManagement: 1,
  },
};

export default configuration;