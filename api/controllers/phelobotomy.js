const router = require('express').Router();
const connection = require('../db')
const PrismaClient = require('@prisma/client').PrismaClient;
const queries = require('../database/queries');
const { getPhelobotomy, updatePhelobotomy, get_client_query } = require('../phelobotomy')


router.route('/api/v1/phelobotomy')
  .get(function (req, res) {
    if (Object.keys(req.query).length == 0) {
      getPhelobotomy(req, res);
    } else {
      if (Object.keys(req.query == 1 && req.query.billingid)) {
        get_client_query(req,res)
      }
    }
  })
  .post(function (req, res) {
    const prisma = new PrismaClient();
    const { test, message, billingid, fullname, time, patientid, status, datetime, alltaken, takenby } = req.body;
    // the test is an array of objects which would be inserted into the table test_ascention
    // step 1 : check if billing id exist in the performing table
    // step 2: update records in the perfoming table
    // step 3: insert records into the test_ascention table

    const updatePerforming = async () => {
      const result = await prisma.performing_test.updateMany({
        where: {
          BILLINGID: billingid
        },
        data: {
          PHELOBOTOMY_MESSAGE: message,
          PHELOBOTOMY_STATUS: status,
          TIME_PHELOBOTOMY_COMPLETED: datetime,
          ALL_SAMPLE_TAKEN: `${alltaken}`,
          SAMPLE_TAKEN_BY: takenby,
        }
      })

      return result;

    }

    const insertTestAscention = async () => {
      // using my swl query to insert multiple records into the test_ascension table
      const insertion = function () {
        const myquery = `INSERT INTO test_ascension (testid,billingid,collection)  VALUES ?`;
        const values = test.map((item) => {
          return [item.testid, billingid, item.collection]
        })

        connection.query(myquery, [values], (err, result) => {
          if (err) {
            res.send({ status: 'error', message: err })
          }
          else {
            res.send({ status: 'success', message: 'records inserted successfully' })
          }
        })
      }


      const checkifExist = function () {
        let count = 0;
        let target = test.length;
        let errCount = 0;

        for (let i = 0; i < test.length; i++) {
          const { collection, billingid, testid } = test[i];

          const myquery = `SELECT * FROM test_ascension WHERE testid = ${testid} AND billingid = ${billingid}`;

          connection.query(myquery,
            (err, result) => {
              if (err) {
                errCount++;
              }

              if (result) {
                const xlength = result.length;

                if (xlength > 0) errCount++;
                count++;

                if (count == target && errCount == 0) {
                  insertion();
                }

                if (count == target && errCount > 0) {
                  res.send({
                    status: 'error',
                    statusCode: 404,
                    message: 'duplicate testid and billing id found in database'
                  })
                }
              }
            }
          )
        }
      }

      checkifExist()
    }

    queries
      .getsingleid(billingid, 'performing_test', 'BILLINGID')
      .then((result) => {
        const rLength = result.length;
        if (rLength === 0) res.send({ status: 'error', message: 'billing id not found' })
        else {
          updatePerforming()
            .then((result) => {
              insertTestAscention();
              prisma.$disconnect()
            })
            .catch((err) => {
              console.log(err)
              res.send({
                status: 'error',
                statusCode: 500
              })
              prisma.$disconnect()
            })
        }
      })
      .catch((err) => { console.log(err) })
  })
  .put(function (req, res) {
    const { clientid, content, status, alltaken, completedTime } = req.body;
    updatePhelobotomy(clientid, content, status, alltaken, completedTime, req, res);
  })
  .delete((req, res) => {
    res.status(405).send({
      statusCode: 405,
      message: `Method ${req.method} Not Allowed`
    });
  })



module.exports = router;
