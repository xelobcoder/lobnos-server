import { testspanels } from "../data/test_creation_metadata";

exports.seed = function (knex) {
     return knex('test_panels').del()
          .then(function () {
               const currentDate = new Date();
               // Inserts seed entries
               
          });
};

