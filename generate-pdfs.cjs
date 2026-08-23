const fs = require('fs');
const PDFDocument = require('pdfkit');
const path = require('path');

const classes = [6, 7, 8, 9, 11];
const units = 6;

const outDir = path.join(__dirname, 'public', 'materials');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function createPDF(filename, text, isWatermarked) {
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(path.join(outDir, filename)));
  
  if (isWatermarked) {
    doc.save()
       .translate(doc.page.width / 2, doc.page.height / 2)
       .rotate(-45)
       .fillColor('#dddddd')
       .fontSize(50)
       .text('PIXIU TECH - VIEW ONLY', -250, -50)
       .restore();
  }

  doc.fillColor('black')
     .fontSize(24)
     .text(text, 50, 50);

  doc.fontSize(12)
     .moveDown()
     .text('This is an auto-generated placeholder PDF to prevent 404 errors.')
     .text('Please replace this file with the actual split PDF from your local computer.');

  doc.end();
}

classes.forEach(c => {
  for (let u = 1; u <= units; u++) {
    createPDF(
      `class${c}-unit${u}-student-watermarked.pdf`,
      `Class ${c} - Unit ${u}\nStudent Book`,
      true
    );
    createPDF(
      `class${c}-unit${u}-teacher.pdf`,
      `Class ${c} - Unit ${u}\nTeacher Pack & Answer Keys`,
      false
    );
  }
});

console.log('Successfully generated 60 PDFs in public/materials');
