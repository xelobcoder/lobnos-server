"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require('dotenv').config({ path: './.env' });
const killport_js_1 = require("./models/security/killport.js");
const port = process.env.NODE_ENV == 'development' ? process.env.DEVELOPMENT_PORT : process.env.PORT || 5000;
(0, killport_js_1.killProcessOnPort)(Number(port)).then(() => {
    require('./app.js');
});
