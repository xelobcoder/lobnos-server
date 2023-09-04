const { createConnection } = require('mysql');
const dotenv = require('dotenv');
dotenv.config();
const connectionData = {
    host: process.env.DEVELOPMENT_DB_HOST,
    user: process.env.DEVELOPMENT_DB_USERNAME,
    password:'',
    database: process.env.DEVELOPMENT_DATABASE,
    ping: true
}

const connection = createConnection(connectionData)

connection.connect(err => {
    if (err) throw err;
    else {console.log('Connected to database');}
})


module.exports = connection;