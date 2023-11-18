const pdf = require('pdf-creator-node');

const fs = require('fs');
const { customError } = require('../../helper');

const path = require('path');
const { getBillingInvoiceData } = require('./invoice');

const html = fs.readFileSync('./api/views/templates/receipt.html', 'utf8');

var options = {
    format: "A3",
    orientation: "portrait",
    border: "10mm",
};

var users = [
    {
        name: "Shyam",
        age: "26",
    },
    {
        name: "Navjot",
        age: "26",
    },
    {
        name: "Vitthal",
        age: "26",
    },
];
var document = {
    html: html,
    path: path.join(__dirname, '../views/pdfs/receipt.pdf'),
    type: "",
};






const createReceipt = async (response, billingid) => {
    try {
        let result = await getBillingInvoiceData(billingid);
        if (result) {
            document.data = result;
            await pdf.create(document, options);
            const filelocation = path.join(__dirname, '../views/pdfs/receipt.pdf')
            response.sendFile(filelocation)
        }
    } catch (err) {
        customError(err?.message, 500, response);
    }
}


module.exports = createReceipt;
