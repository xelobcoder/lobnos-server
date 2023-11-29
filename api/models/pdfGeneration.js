const pdf = require('pdf-creator-node');
const fs = require('fs');
const { customError, promisifyQuery, getFullBloodCountTrend, convertKeysToLowerCase } = require('../../helper');
const path = require('path');
const { testTable, setups, PDF_QUERIES } = require('../../helpers/testtables');
const { testCategoryMapping } = require('../../api/models/ResultQueryMapping');
const ResultPrint = require('./ResultPrint');
const { getCompanyInfo } = require('../settings/companydata');
const logger = require('../../logger');
const Registration = require('./registration');


const rendererOptions = function (opt) {
    switch (opt) {
        case 'hema' :
            return './api/views/pdfs/result/hematological.html';
            break;
        case 'fbc':
            return './api/views/pdfs/result/chemistry.html';
        break;
        case "chemistry":
            return './api/views/pdfs/result/chemistry.html';
            break;
        case "endocrinology":
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
        result = await promisifyQuery(PDF_QUERIES.hematologicalQ(resulttable), [this.billingid]);
        result = result.length > 0 ? result.map((item, index) => { return convertKeysToLowerCase(item) })[0] : [];
        let resultdata = null;
        if (testname === 'malaria') {
            const parasites = { parameter: 'Parasite Number', value: result['parasitenumber'] };
            const species = { parameter: 'Species', value: result['species'] };
            const comments = result['comments'];
            resultdata = [parasites, species];
            resultdata['comments'] = comments;
        }

        if (testname === 'hepatitis_b_profile') {
            const hbeag = { parameter: 'HBeAg', value: result['hbeag'] };
            const hbeab = { parameter: 'HBeAb', value: result['hbeab'] };
            const hbsag = { parameter: 'HBsAg', value: result['hbsag'] };
            const hbsab = { parameter: 'HBsAb', value: result['hbsab'] };
            const hbcab = { parameter: 'HBcAb', value: result['hbcab'] };
            const comments = result['comments'];
             resultdata = [hbeag, hbeab, hbsag, hbsab, hbcab];
            resultdata['comments'] = comments;
        }

        if (testname === 'helicobacter_pylori') {
            const specimen = { parameter: 'Specimen', value: result['specimen'] };
            const hpylori = { parameter: 'result', value: result['result'] };
             resultdata = [specimen, hpylori];
            const comments = result['comments'];
            resultdata['comments'] = comments;
        }

        if (testname === 'blood_grouping') {
            const abo = { parameter: 'ABO', value: result['abo'] };
            const rh = { parameter: 'RH', value: result['rh'] };
            resultdata = [abo, rh];
            const comments = result['comments'];
            resultdata['comments'] = comments
        }

        if (testname === 'aids') {
            const reaction = { parameter: 'Reaction', value: result['reaction'] };
            resultdata = [reaction];
            const comments = result['comments'];
            resultdata['comments'] = comments
        }

        if (testname === 'widal') {
            const typhio = { parameter: 'Typhio', value: result['typhio'] };
            const typhiH = { parameter: 'TyphiH', value: result['typhih'] };
            const paratyphiah = { parameter: 'ParatyphiAH', value: result['paratyphiah'] };
            const paratyphiBh = { parameter: 'ParatyphiBH', value: result['paratyphibh'] };
            resultdata = [typhio, typhiH, paratyphiah, paratyphiBh];
            const comments = result['comments'];
            resultdata['comments'] = comments
        }

        if (testname === 'pregnancy_test') {
            const method = { parameter: 'Specimen', value: result['method'] };
            const value = { parameter: 'Result', value: result['value'] };
            resultdata = [method, value];
            const comments = result['comments'];
            resultdata['comments'] = comments
        }

        if (testname === 'semen_analysis') {
            const collectiondate = { parameter: 'Collection Date', value: new Date(result['collectiondate']).toLocaleDateString() }
            const spermcount = { parameter: 'Sperm Count', value: result['spermcount'] };
            const collectiontime = { parameter: 'Collection Time', value: result['collectiontime'] };
            const abstinence = { parameter: 'Abstinence', value: result['abstinence'] };
            const quantity = { parameter: 'Quantity', value: result['quantity'] };
            const colour = { parameter: 'Colour', value: result['colour'] };
            const consistency = { parameter: 'Consistency', value: result['consistency'] };
            const motility = { parameter: 'Motility', value: result['motility'] };
            const motilityGrade = { parameter: 'Motility Grade', value: result['motilitygrade'] };
            const morphology = { parameter: 'Morphology', value: result['morphology'] };
            const pusCells = { parameter: 'Pus Cells', value: result['puscells'] };
            const rbcs = { parameter: 'RBCs', value: result['rbcs'] };
            const liquefactionTime = { parameter: 'Liquefaction Time', value: result['liquefactiontime'] };
            const ph = { parameter: 'PH', value: result['ph'] };
            const fructose = { parameter: 'Fructose', value: result['fructose'] };
            const epithelialCells = { parameter: 'Epithelial Cells', value: result['epithelialcells'] };
            resultdata = [collectiondate, collectiontime, spermcount, abstinence, quantity, colour, consistency, motility, motilityGrade, morphology, pusCells, rbcs, liquefactionTime, ph, fructose, epithelialCells];
            const comments = result['impression'];
            resultdata['comments'] = comments
        }

        if (testname === 'urinalysis') {
            const appearance = { parameter: 'Appearance', value: result['appearance'] };
            const color = { parameter: 'Color', value: result['color'] };
            const urobilinogen = { parameter: 'Urobilinogen', value: result['urobilinogen'] };
            const ketones = { parameter: 'Ketones', value: result['ketones'] };
            const bilirubin = { parameter: 'Bilirubin', value: result['bilirubin'] };
            const nitrite = { parameter: 'Nitrite', value: result['nitrite'] };
            const microalbumin = { parameter: 'Microalbumin', value: result['microalbumin'] };
            const glucose = { parameter: 'Glucose', value: result['glucose'] };
            const specific_gravity = { parameter: 'Specific Gravity', value: result['specific_gravity'] };
            const ph = { parameter: 'PH', value: result['ph'] };
            const microscopy = { parameter: 'Microscopy', value: result['microscopy'] };
            const remarks = { parameter: 'Remarks', value: result['remarks'] };
            const blood = { parameter: 'Blood', value: result['blood'] };
            const leukocytes = { parameter: 'Leukocytes', value: result['leukocytes'] };
            resultdata = [appearance, color, urobilinogen, ketones, bilirubin, nitrite, microalbumin, glucose, specific_gravity, ph, microscopy, remarks, blood, leukocytes];
            const comments = result['remarks'];
            resultdata['comments'] = comments
        }

        if (testname === 'aids') {
            const reaction = { parameter: 'Reaction', value: result['reaction'] };
            resultdata = [reaction];
            const comments = result['comments'];
            resultdata['comments'] = comments
        }

        if (testname === 'glycated_heamoglobin') {
            const averageGlucose = { parameter: 'Average Glucose', value: result['glucose'] };
            const hba1c = { parameter: 'HBA1C', value: result['result'] };
            resultdata = [averageGlucose, hba1c];
            const comments = result['comments'];
            resultdata['comments'] = comments
        }

        return resultdata;
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
                    return await getFullBloodCountTrend(patientid);
                }

                if (category && category == 'hema') {
                    const data = await this.getHematologicalTest(resulttable, this.testname);
                    return data;
                }

                if (category && category == 'endocrinology') { 
                    const getPatientid = await new Registration().getPatientInfoUsingBillingId(this.billingid);
                    const gender = getPatientid.length > 0 ? getPatientid[0]['gender'] : null;
                    const query  = PDF_QUERIES.endrinologyQ(resulttable,setupName,this.billingid,gender)
                    const data = await promisifyQuery(query, [this.billingid]);
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
