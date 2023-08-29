const { createConnection } = require('mysql');

const connectionData = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'limsdb',
    ping: true
}

const connection = createConnection(connectionData)

connection.connect(err => {
    if (err) throw err;
    console.log('Connected to database');
})


module.exports = connection;