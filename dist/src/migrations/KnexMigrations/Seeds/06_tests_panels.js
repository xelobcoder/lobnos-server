"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seed = function (knex) {
    return knex('test_panels').del()
        .then(function () {
        const currentDate = new Date();
        // Inserts seed entries
    });
};
