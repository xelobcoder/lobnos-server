require('dotenv').config({ path: './.env' });

import { killProcessOnPort } from './models/security/killport.js';

const port = process.env.NODE_ENV == 'development' ? process.env.DEVELOPMENT_PORT : process.env.PORT || 5000;

killProcessOnPort(Number(port)).then(() => {
     require('./app.js');
});