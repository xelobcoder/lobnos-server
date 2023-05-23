const connection = require("./db");


let filteredTest_in_date = function (test, res) {
  // check if array
  const isArray = Array.isArray(test) ? true : false;
  // check is empty or not

  const isEmpty = test.length == 0 ? true : false;

  if (isArray && !isEmpty) {
    let today = new Date();

    let filtereddate = test.filter(function (item) {
      // filter today from test array
      let date = new Date(item.DATE);
      return date.getDate() == today.getDate() && date.getMonth() == today.getMonth() && date.getFullYear() == today.getFullYear();
    })

    res.send(filtereddate);
  }
  else {
    res.send(test);
  }
}

const getPhelobotomy = async (req, res) => {
  let myquery = `
  SELECT DISTINCT *
      FROM new_patients AS p
      INNER JOIN billing AS b ON p.PATIENTID = b.PATIENTID
      INNER JOIN performing_test as t ON b.BILLINGID = t.BILLINGID
      WHERE t.PHELOBOTOMY_STATUS = 'QUEUE'
      AND p.ACTIVATION_STATUS = 'TRUE'
      AND t.DATE = CURDATE() GROUP BY t.ID ORDER BY t.ID DESC
  `;

  connection.query(myquery, (err, result) => {
    if (err) throw err;
    filteredTest_in_date(result, res);
  })
}

const get_client_query = function (req, res) {
  let{ billingid } = req.query;

  if (!billingid) {
    res.send({
      statusCode: 200,
      status: 'success',
      message: 'billingid required'
    })
  }

  if (billingid) {
    // parseint to ensure a valid integer is queried againts db
    billingid = parseInt(billingid);

    const query = `SELECT * FROM NEW_PATIENTS AS np
    INNER JOIN BILLING AS b ON np.PATIENTID = b.PATIENTID
    INNER JOIN PERFORMING_TEST AS p ON b.BILLINGID = p.BILLINGID
    WHERE p.BILLINGID = ?`

    connection.query(query, billingid,function (err, result) {
      if (err) {
        res.send({
          message: 'error', statusCode: 500, message: err.sqlMessage
        })
      }
      else {
        res.send({
          message: 'success',
          statusCode: 200,
          result
        })
      }
    })
  }
}


const updatePhelobotomy = async (id, content, status, alltaken, completedTime, req, res) => {
  let myquery = `UPDATE 
  performing_test 
  SET PHELOBOTOMY_STATUS = '${status}',
  PHELOBOTOMY_MESSAGE = '${content}',
  ALL_SAMPLE_TAKEN = '${alltaken}',
  TIME_PHELOBOTOMY_COMPLETED = TIMESTAMP('${completedTime}')
  WHERE ID = ${id}`;
  connection.query(myquery, (err, result) => {
    if (err) throw err;
    res.send(result);
  }
  )
}


// function handler(req, res) {
//   let method = req.method;
//   switch (method) {
//     case 'GET':
//       if (Object.keys(req.query).length == 0) {
//         getPhelobotomy(req, res);
//       }
//       break;
//     case 'PUT':
//       const { clientid, content, status ,alltaken,completedTime} = JSON.parse(req.body);
//       console.log(clientid, content, status);
//       updatePhelobotomy(clientid, content, status, alltaken, completedTime,req, res);
//       break;
//     default:
//       res.status(405).send(`Method ${method} Not Allowed`);
//   }
// }


module.exports = {
  getPhelobotomy,
  updatePhelobotomy,
  get_client_query
}