exports.seed = async function (knex) {
     return await knex('paymentmodes').insert([
          { KeyID: 1, PaymentMode: 'Momo' },
          { KeyID: 2, PaymentMode: 'Cash' },
          { KeyID: 3, PaymentMode: 'cheque' },
          { KeyID: 4, PaymentMode: 'free' }
     ]);
};
