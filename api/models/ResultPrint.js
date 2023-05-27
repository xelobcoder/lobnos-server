const connection = require("../db");
const { Result } = require('./result');
const ResultClass = new Result();
const errMessage = ResultClass.errMessage
const pushResponse = ResultClass.pushResponse

class ResultPrint {
   constructor(billingid) {
      this.billingid = billingid;
   }


   get_printables = (request, response) => {
      const { querydate, content } = request.query;
      let modelQuery = `
      SELECT 
          ta.billingid AS billingid,
      CASE
         WHEN COUNT(ta.testid) = (SELECT COUNT(*) FROM test_ascension WHERE billingid = ta.billingid) THEN 'Ready'
         WHEN COUNT(ta.testid) < (SELECT COUNT(*) FROM test_ascension WHERE billingid = ta.billingid) THEN 'Partial'
         ELSE 'Unknown'
      END AS status,
         ta.ready,
         ta.ready_date,
         b.OUTSTANDING AS outstanding,
         b.PAID_AMOUNT AS paid_amount,
         np.PATIENTID AS patientid,
         COUNT(ta.testid) AS readycount,
         (SELECT COUNT(*) FROM test_ascension WHERE billingid = ta.billingid) AS testcount,
         CONCAT(np.FIRSTNAME, ' ', np.MIDDLENAME, ' ', np.LASTNAME) AS fullname
      FROM 
         TEST_ASCENSION AS ta 
         INNER JOIN billing AS b ON b.BILLINGID = ta.billingid
         INNER JOIN new_patients AS np ON b.PATIENTID = np.PATIENTID
      WHERE 
         ta.ready = 'true'
      `

      const params = [];

      // Add filters if provided
      if (querydate) {
         modelQuery += ' AND DATE(ta.ready_date) = ?';
         params.push(querydate);
      }
      else {
         modelQuery += ' AND DATE(ta.ready_date) = CURDATE()';
      }

      if (content) {
         modelQuery += ' AND ta.billingid = ?';
         params.push(content);
      }

      modelQuery += ' GROUP BY ta.billingid ORDER BY ta.billingid DESC LIMIT 100';


      connection.query(modelQuery, params, (err, result) => {
         if (err) {
            errMessage.call(this, err, response);
         }
         else[
            response.send(result)
         ]
      })
   }


   get_extrainfo_test = (id, request, response) => {
      const model = `SELECT tp.NAME AS name,
      ta.testid,
       ta.ready
       FROM test_ascension AS ta 
      INNER JOIN test_panels AS tp ON ta.testid = tp.ID
      WHERE billingid = ?`

      connection.query(model, id, (err, result) => {
         if (err) {
            errMessage.call(this, err, response);
         }
         else[
            response.send(result)
         ]
      })
   }


   run_query = async (query, date) => {
      try {
         return new Promise((reject, resolve) => {
            connection.query(query, date, (err, result) => {
               if (err) {
                  reject(err)
               }

               resolve(result)
            })
         })
      }
      catch (err) {
         throw err;
      }
   }


   get_summary_ready_page = async (request, response) => {
      const { querydate, content } = request.query;

      const query = `SELECT 
       pt.DATE,
       pt.BILLINGID,
       tt.collection,
       (SELECT COUNT(*) FROM performing_test WHERE DATE = ?) AS registered,
       pt.PHELOBOTOMY_STATUS,
       tt.ready,
       tt.collection_date,
       tt.processing,
       tt.testid
        FROM performing_test AS pt
       INNER JOIN BILLING AS b ON b.billingid = pt.billingid
       INNER JOIN test_ascension AS tt ON tt.billingid = b.BILLINGID
       WHERE pt.DATE = ?
       `

      function getTodayDate() {
         const currentDate = new Date();
         const year = currentDate.getFullYear();
         const month = String(currentDate.getMonth() + 1).padStart(2, '0');
         const day = String(currentDate.getDate()).padStart(2, '0');
         return `${year}-${month}-${day}`;
      }


      connection.query(query, [querydate || getTodayDate(), querydate || getTodayDate()], (err, result) => {
         if (err) {
            throw err;
         }
         else {
            if (result.length == 0) {
               response.send([
                  {
                     title: 'registered clients',
                     value: 0
                  },
                  {
                     title: 'processing test',
                     value: 0
                  },
                  {
                     title: 'collected test samples',
                     value: 0
                  },
                  {
                     title: 'test ready',
                     value: 0
                  }
               ])
            }
            else {
               const processing = result.filter((item, index) => {
                  return item.processing == 'true' && item.ready == 'false'
               }).length
               const ready = result.filter((item, index) => {
                  return item.processing == 'true' && item.ready == 'true'
               }).length;
               const collection = result.filter((item, index) => {
                  return item.collection == 'true'
               }).length;

               response.send([
                  {
                     title: 'registered clients',
                     value: result[0]?.['registered']
                  },
                  {
                     title: 'processing test',
                     value: processing
                  },
                  {
                     title: 'collected test samples',
                     value: collection
                  },
                  {
                     title: 'test ready',
                     value: ready
                  }
               ])
            }
         }
      })
   }
}



module.exports = ResultPrint;