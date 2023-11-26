const pdf = require('pdf-creator-node');
const fs = require('fs');
const { customError, promisifyQuery, getFullBloodCountTrend, convertKeysToLowerCase } = require('../../helper');
const path = require('path');
const { testTable, setups, PDF_QUERIES } = require('../../helpers/testtables');
const { testCategoryMapping } = require('../../api/models/ResultQueryMapping');
const Patient = require('../../api/models/patientAnalytics');
const ResultPrint = require('./ResultPrint');
const { getCompanyInfo } = require('../settings/companydata');
const logger = require('../../logger');


const rendererOptions = function (opt) {
    switch (opt) {
        case 'hema':
            return './api/views/pdfs/result/hematological.html';
            break;
        case 'fbc':
            return './api/views/pdfs/result/chemistry.html';
        break;
        case "chemistry":
            return './api/views/pdfs/result/chemistry.html';
            break;
        case 'syphilis':
            return './api/views/pdfs/result/syphilis.html';
            break;
        default:
            return './api/views/templates/receipt.html';
            break;
    }
}






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


    async getHematologicalTest(resulttable, testname) {
        let result = null;
        if (testname === 'malaria') {
            result = await promisifyQuery(PDF_QUERIES.hematologicalQ(resulttable), [this.billingid]);
            result = result.length > 0 ? result.map((item, index) => { return convertKeysToLowerCase(item) })[0] : [];
            const parasites = { parameter: 'Parasite Number', value: result['parasitenumber'] };
            const species = { parameter: 'Species', value: result['species'] };
            const comments = result['comments'];
            const resultdata = [parasites, species];
            resultdata['comments'] = comments;
            return resultdata;
        }

        if (testname === 'hepatitis_b_profile') {
            result = await promisifyQuery(PDF_QUERIES.hematologicalQ(resulttable), [this.billingid]);
            result = result.length > 0 ? result.map((item, index) => { return convertKeysToLowerCase(item) })[0] : [];
            const hbeag = { parameter: 'HBeAg', value: result['hbeag'] };
            const hbeab = { parameter: 'HBeAb', value: result['hbeab'] };
            const hbsag = { parameter: 'HBsAg', value: result['hbsag'] };
            const hbsab = { parameter: 'HBsAb', value: result['hbsab'] };
            const hbcab = { parameter: 'HBcAb', value: result['hbcab'] };
            const comments = result['comments'];
            const resultdata = [hbeag, hbeab, hbsag, hbsab, hbcab];
            resultdata['comments'] = comments;
            return resultdata;
        }

        if (testname === 'helicobacter_pylori') {
            result = await promisifyQuery(PDF_QUERIES.hematologicalQ(resulttable), [this.billingid]);
            result = result.length > 0 ? result.map((item, index) => { return convertKeysToLowerCase(item) })[0] : [];
            const specimen = { parameter: 'Specimen', value: result['specimen'] };
            const hpylori = { parameter: 'result', value: result['result'] };
            const resultdata = [specimen, hpylori];
            const comments = result['comments'];
            resultdata['comments'] = comments
            return resultdata;
        }
    }

    async getChemistryTest() {
        if (await this.checkApproval(this.billingid, this.testid)) {
            const resulttable = this.isValidTest();
            if (resulttable) {
                const setupName = this.isSetupAvailabble();
                const category = this.isCategoryAvailable();
                let result = null;
                if (setupName && category && category == 'chemistry') {
                    result = await promisifyQuery(PDF_QUERIES.chemistryQ(resulttable, setupName, this.billingid));
                }

                if (category === 'syphilis' && category) {
                    result = await promisifyQuery(PDF_QUERIES.hematologicalQ(resulttable), [this.billingid]);;
                }

                if (category && category == 'fbc') {
                    const getPatientidResult = await promisifyQuery(PDF_QUERIES.getPatientid, [this.billingid]);
                    const patientid = getPatientidResult.length > 0 ? getPatientidResult[0]['patientid'] : null;
                    // iniatialize patient class, patint is a subclass of Registration class
                    return await getFullBloodCountTrend(patientid);
                }

                if (category && category == 'hema') {
                    const data = await this.getHematologicalTest(resulttable, this.testname);
                    return data;
                }

                return result;
            } else { return `${this.testname} is not a valid test` }
        } else {
            return 'Test not approved for printing';
        }
    }

    async generatePDFdata() {
        try {
            const testInformation = await this.getChemistryTest();
            let sampling = await this.getSamplingInformation(this.billingid, this.testid);
            const companyinfo = await getCompanyInfo();
            if (sampling.length > 0) {
                sampling = sampling[0];
                sampling['collection_date'] = sampling['collection_date'].toLocaleDateString();
            } else {
                sampling = {};
            }
            const testname = this.testname.includes('_') ? this.testname.split('_').join(' ') : this.testname;
            const comments = await this.getComments(this.billingid, this.testid);
            return {
                testname, testInformation, sampling,
                comments: comments.length > 0 ? comments[0]['comments'] : '', companyinfo: companyinfo.length > 0 ? companyinfo[0] : {}
            };
        } catch (err) {
            logger.error(err);
            console.log(err);
            return ('error generating pdf data')
        }
    }


    async generatePDFResult(data, response) {
        const html = fs.readFileSync(rendererOptions(this.isCategoryAvailable()), 'utf-8');
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
