const winston = require('winston');

const logger = winston.createLogger({
  level: 'error', 
  format: winston.format.json(), 
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }), 
    new winston.transports.Console() 
  ],
});

process.on('uncaughtException', (ex) => {
  console.error('Uncaught Exception:', ex);
  process.exit(1); 
});


process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

module.exports = logger;
