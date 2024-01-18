const mysql = require('mysql');

const connectionData = {
 host: 'localhost',
 user: 'root',
 password: '',
  database: 'limsdb',
}


const connectionpool = mysql.createPool(connectionData);

connectionpool.getConnection((err, connection) => {
 if (err) {
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
   console.error('Database connection was closed.');
  }
  if (err.code === 'ER_CON_COUNT_ERROR') {
   console.error('Database has too many connections.');
  }
  if (err.code === 'ECONNREFUSED') {
   console.error('Database connection was refused.');
   }
   
   if (err.code === 'ER_DUP_ENTRY') {
     console.log('Duplicates values violation occured');
   }
 }

  if (connection) connection.release();
 return;
});




module.exports = connectionpool;