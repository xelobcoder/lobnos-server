const pdf = require('pdf-creator-node');
const fs = require('fs');
const { customError, promisifyQuery } = require('../../helper');
const path = require('path');
const { testTable, setups, PDF_QUERIES } = require('../../helpers/testtables');
const { testCategoryMapping } = require('../../api/models/ResultQueryMapping');
const ResultPrint = require('./ResultPrint');
const { getCompanyInfo } = require('../settings/companydata');
const logger = require('../../logger');

const rendererOptions = function (opt) {
    switch (opt) {
        case 'hema':
            return './api/views/pdfs/result/basicHematology.html';
            break;
        case "chemistry":
            return './api/views/pdfs/result/chemistry.html';
        default:
            return './api/views/templates/receipt.html';
            break;
    }
}



var html = fs.readFileSync(rendererOptions('chemistry'), 'utf8');



class PDFGENERATION extends ResultPrint {
    constructor(billingid, testid, testname) {
        super();
        this.billingid = billingid;
        this.testid = testid;
        this.testname = testname;
    }

    isValidTest() { return testTable[this.testname] != undefined ? testTable[this.testname] : false }
    isCategoryAvailable() { return testCategoryMapping[this.testname] != undefined ? testCategoryMapping[this.testname] : false }
    isSetupAvailabble() { return setups[this.testname] != undefined ? setups[this.testname] : false };

    async getChemistryTest() {
        if (await this.checkApproval(this.billingid, this.testid)) {
            const resulttable = this.isValidTest();
            if (resulttable) {
                const setupName = this.isSetupAvailabble();
                const category = this.isCategoryAvailable();
                if (setupName && category && category == 'chemistry') {
                    const result = await promisifyQuery(PDF_QUERIES.chemistryQ(resulttable, setupName, this.billingid));
                    result.testname = this.testname
                    return result;
                } else {
                    return 'provided details incorrect';
                }
            } else { return `${this.testname} is not a valid test` }
        } else {
            customError('Test not approved for printing', 401, response);
        }
    }

    async generatePDFdata() {
        try {
            const testInformation = await this.getChemistryTest();
            const sampling = await this.getSamplingInformation(this.billingid, this.testid);
            const companyinfo = await getCompanyInfo();
            const comments = await this.getComments(this.billingid, this.testid);
            return {
                testInformation, sampling: sampling.length > 0 ? sampling[0] : {},
                comments: comments.length > 0 ? comments[0]['comments'] : '', companyinfo: companyinfo.length > 0 ? companyinfo[0] : {}
            };
        } catch (err) {
            logger.error(err);
            return ('error generating pdf data')
        }
    }


    async generatePDFResult(data, response) {
        var options = {
            format: "A3",
            orientation: "portrait",
            border: "10mm",
        };

        var document = {
            html: html,
            path: path.join(__dirname, '../views/pdfs/receipt.pdf'),
            type: "",
        };

        try {
            if (data) {
                document.data = data
                await pdf.create(document, options);
                const filelocation = path.join(__dirname, '../views/pdfs/receipt.pdf')
                if (response) { response.sendFile(filelocation); }
            }
        } catch (err) {
            customError(err?.message, 500, response);
        }
    }
}







module.exports = PDFGENERATION;
