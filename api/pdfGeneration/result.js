const fs = require('fs');
const PDFDocument = require('pdfkit');

const createLabResultPDF = (results) => {
  const doc = new PDFDocument();

  const stream = fs.createWriteStream('lab_results.pdf');
  doc.pipe(stream);

  // Add a title to the PDF
  doc.fontSize(18).text('Lab Results', { align: 'center' }).moveDown(0.5);

  // Create a table header
  doc.font('Helvetica-Bold');
  doc.text('Parameter', 50, 50);
  doc.text('Upper Limit', 200, 50);
  doc.text('Lower Limit', 300, 50);
  doc.text('Unit', 400, 50);
  doc.text('Value', 500, 50);
  doc.moveDown(0.5);
  doc.font('Helvetica');

  // Add rows to the table based on lab results
  let yPosition = 70; // Initial y position for the first row
  results.forEach((result) => {
    doc.text(result.parameter, 50, yPosition);
    doc.text(result.upper.toString(), 200, yPosition);
    doc.text(result.lower.toString(), 300, yPosition);
    doc.text(result.unit, 400, yPosition);
    doc.text(result.value.toString(), 500, yPosition);
    yPosition += 20; // Adjust for the next row
  });

  doc.end();

  console.log('Lab Results PDF created successfully.');
};

const labResults = [
  {
    "parameter": "albumin",
    "upper": 300,
    "lower": 600,
    "unit": "mg/dl",
    "value": 30
  },
  {
    "parameter": "total protein",
    "upper": 600,
    "lower": 300,
    "unit": "mg/dl",
    "value": 40
  },
  {
    "parameter": "alp",
    "upper": 600,
    "lower": 600,
    "unit": "mg/dl",
    "value": 30
  },
];

createLabResultPDF(labResults);
