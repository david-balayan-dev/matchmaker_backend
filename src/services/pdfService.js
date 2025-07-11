const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const PDFKit = require('pdfkit');

// Generate complete application PDF
const generateApplicationPDF = async (userData) => {
  try {
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Add a page to the document
    const page = pdfDoc.addPage([612, 792]); // Letter size: 8.5 x 11 inches
    
    // Get the standard font
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Set up some common styles
    const titleSize = 18;
    const headingSize = 14;
    const standardSize = 11;
    const smallSize = 9;
    
    const margin = 50;
    let yOffset = page.getHeight() - margin; // Start from the top
    
    // Helper function to draw text and move the y offset
    const drawText = (text, { font = helveticaFont, size = standardSize, color = rgb(0, 0, 0), alignment = 'left', indent = 0 } = {}) => {
      const textWidth = font.widthOfTextAtSize(text, size);
      let xPos = margin + indent;
      
      if (alignment === 'center') {
        xPos = (page.getWidth() - textWidth) / 2;
      } else if (alignment === 'right') {
        xPos = page.getWidth() - margin - textWidth;
      }
      
      page.drawText(text, {
        x: xPos,
        y: yOffset,
        font,
        size,
        color
      });
      
      yOffset -= size + 5; // Move down for the next line
      return yOffset;
    };
    
    // Helper function to check if we need a new page
    const checkForNewPage = (spaceNeeded) => {
      if (yOffset < margin + spaceNeeded) {
        // Add a new page
        const newPage = pdfDoc.addPage([612, 792]);
        page = newPage;
        yOffset = page.getHeight() - margin;
      }
    };
    
    // Title
    drawText('RESIDENCY APPLICATION', { font: helveticaBold, size: titleSize, alignment: 'center' });
    yOffset -= 10; // Extra space after title
    
    // Personal Information
    drawText('PERSONAL INFORMATION', { font: helveticaBold, size: headingSize, color: rgb(0.1, 0.4, 0.6) });
    yOffset -= 5;
    
    drawText(`Name: ${userData.firstName} ${userData.lastName}`, { size: standardSize });
    drawText(`Email: ${userData.email}`, { size: standardSize });
    drawText(`Phone: ${userData.phone}`, { size: standardSize });
    drawText(`Address: ${userData.address.street}, ${userData.address.city}, ${userData.address.state} ${userData.address.zipCode}, ${userData.address.country}`, { size: standardSize });
    drawText(`Medical School: ${userData.demographics.medicalSchool}`, { size: standardSize });
    
    yOffset -= 15; // Extra space
    
    // Personal Statement
    checkForNewPage(300); // Personal statement needs space
    
    drawText('PERSONAL STATEMENT', { font: helveticaBold, size: headingSize, color: rgb(0.1, 0.4, 0.6) });
    yOffset -= 5;
    
    // Split personal statement into paragraphs and draw them
    const paragraphs = userData.personalStatement.finalStatement.split('\n\n');
    paragraphs.forEach(paragraph => {
      // Word wrap logic would go here in a real implementation
      drawText(paragraph, { size: standardSize });
      yOffset -= 5; // Space between paragraphs
    });
    
    yOffset -= 15; // Extra space
    
    // Research Products
    checkForNewPage(200);
    
    drawText('RESEARCH PRODUCTS', { font: helveticaBold, size: headingSize, color: rgb(0.1, 0.4, 0.6) });
    yOffset -= 5;
    
    if (userData.researchProducts.length === 0) {
      drawText('No research products listed.', { size: standardSize, color: rgb(0.5, 0.5, 0.5) });
    } else {
      userData.researchProducts.forEach((product, index) => {
        checkForNewPage(80);
        
        drawText(`${index + 1}. ${product.title}`, { font: helveticaBold, size: standardSize });
        drawText(`Type: ${product.type}`, { size: smallSize, indent: 10 });
        drawText(`Status: ${product.status}`, { size: smallSize, indent: 10 });
        drawText(`Authors: ${product.authors}`, { size: smallSize, indent: 10 });
        
        if (product.journal) {
          let journalText = `Journal: ${product.journal}`;
          if (product.volume) journalText += `, Vol. ${product.volume}`;
          if (product.issueNumber) journalText += `, Issue ${product.issueNumber}`;
          if (product.pages) journalText += `, pp. ${product.pages}`;
          drawText(journalText, { size: smallSize, indent: 10 });
        }
        
        if (product.pmid) {
          drawText(`PMID: ${product.pmid}`, { size: smallSize, indent: 10 });
        }
        
        if (product.monthPublished || product.yearPublished) {
          let dateText = 'Published: ';
          if (product.monthPublished) dateText += `${product.monthPublished} `;
          if (product.yearPublished) dateText += product.yearPublished;
          drawText(dateText, { size: smallSize, indent: 10 });
        }
        
        yOffset -= 5; // Space between research products
      });
    }
    
    yOffset -= 15; // Extra space
    
    // Experiences
    checkForNewPage(200);
    
    drawText('EXPERIENCES', { font: helveticaBold, size: headingSize, color: rgb(0.1, 0.4, 0.6) });
    yOffset -= 5;
    
    if (userData.experiences.length === 0) {
      drawText('No experiences listed.', { size: standardSize, color: rgb(0.5, 0.5, 0.5) });
    } else {
      // First list most meaningful experiences
      const mostMeaningful = userData.experiences.filter(exp => exp.isMostMeaningful);
      if (mostMeaningful.length > 0) {
        drawText('Most Meaningful Experiences', { font: helveticaBold, size: standardSize });
        yOffset -= 5;
        
        mostMeaningful.forEach((exp, index) => {
          checkForNewPage(100);
          
          drawText(`${index + 1}. ${exp.positionTitle} - ${exp.organization}`, { font: helveticaBold, size: standardSize });
          
          const dateText = `${new Date(exp.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${exp.isCurrent ? 'Present' : new Date(exp.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
          drawText(dateText, { size: smallSize, indent: 10 });
          
          drawText(`${exp.description}`, { size: smallSize, indent: 10 });
          
          if (exp.expandedDescription) {
            drawText(`Reflection: ${exp.expandedDescription}`, { size: smallSize, indent: 10, color: rgb(0.2, 0.2, 0.8) });
          }
          
          yOffset -= 10; // Space between experiences
        });
      }
      
      // Then list other experiences
      const otherExperiences = userData.experiences.filter(exp => !exp.isMostMeaningful);
      if (otherExperiences.length > 0) {
        drawText('Other Experiences', { font: helveticaBold, size: standardSize });
        yOffset -= 5;
        
        otherExperiences.forEach((exp, index) => {
          checkForNewPage(80);
          
          drawText(`${index + 1}. ${exp.positionTitle} - ${exp.organization}`, { font: helveticaBold, size: standardSize });
          
          const dateText = `${new Date(exp.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${exp.isCurrent ? 'Present' : new Date(exp.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
          drawText(dateText, { size: smallSize, indent: 10 });
          
          drawText(`${exp.description}`, { size: smallSize, indent: 10 });
          
          yOffset -= 10; // Space between experiences
        });
      }
    }
    
    // Miscellaneous Questions
    checkForNewPage(200);
    
    drawText('ADDITIONAL INFORMATION', { font: helveticaBold, size: headingSize, color: rgb(0.1, 0.4, 0.6) });
    yOffset -= 5;
    
    if (userData.miscellaneous.professionalism.hasIssues) {
      drawText('Professionalism Issues:', { font: helveticaBold, size: standardSize });
      drawText(userData.miscellaneous.professionalism.explanation, { size: smallSize, indent: 10 });
      yOffset -= 10;
    }
    
    // Education
    drawText('Education:', { font: helveticaBold, size: standardSize });
    yOffset -= 5;
    
    if (userData.miscellaneous.education.undergraduate.length > 0) {
      drawText('Undergraduate:', { font: helveticaBold, size: smallSize, indent: 10 });
      userData.miscellaneous.education.undergraduate.forEach(edu => {
        const eduText = `${edu.school}, ${edu.fieldOfStudy}, ${new Date(edu.startDate).getFullYear()}-${new Date(edu.endDate).getFullYear()}`;
        drawText(eduText, { size: smallSize, indent: 20 });
      });
      yOffset -= 5;
    }
    
    if (userData.miscellaneous.education.graduate.length > 0) {
      drawText('Graduate:', { font: helveticaBold, size: smallSize, indent: 10 });
      userData.miscellaneous.education.graduate.forEach(edu => {
        const eduText = `${edu.school}, ${edu.fieldOfStudy}, ${new Date(edu.startDate).getFullYear()}-${new Date(edu.endDate).getFullYear()}`;
        drawText(eduText, { size: smallSize, indent: 20 });
      });
      yOffset -= 5;
    }
    
    // Honors and Awards
    if (userData.miscellaneous.honorsAwards.length > 0) {
      checkForNewPage(100);
      
      drawText('Honors and Awards:', { font: helveticaBold, size: standardSize });
      userData.miscellaneous.honorsAwards.forEach((award, index) => {
        const awardText = `${index + 1}. ${award.title} (${new Date(award.date).getFullYear()}) - ${award.description}`;
        drawText(awardText, { size: smallSize, indent: 10 });
      });
      yOffset -= 10;
    }
    
    // Impactful Experience and Hobbies
    checkForNewPage(100);
    
    if (userData.miscellaneous.impactfulExperience) {
      drawText('Impactful Experience:', { font: helveticaBold, size: standardSize });
      drawText(userData.miscellaneous.impactfulExperience, { size: smallSize, indent: 10 });
      yOffset -= 10;
    }
    
    if (userData.miscellaneous.hobbiesInterests) {
      drawText('Hobbies and Interests:', { font: helveticaBold, size: standardSize });
      drawText(userData.miscellaneous.hobbiesInterests, { size: smallSize, indent: 10 });
    }
    
    // Serialize the PDFDocument to bytes (a Uint8Array)
    const pdfBytes = await pdfDoc.save();
    
    return pdfBytes;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate application PDF');
  }
};

/**
 * Generate a PDF for a personal statement
 * @param {Object} data - Personal statement data
 * @param {Stream} outputStream - Stream to write the PDF to
 * @returns {Promise<void>}
 */
const generatePersonalStatementPDF = async (data, outputStream) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('PDF Generation - Starting PDF creation process');
      
      if (!data) {
        throw new Error('No data provided for PDF generation');
      }
      
      // Extract data with fallbacks to handle different field naming conventions
      const specialties = Array.isArray(data.specialties) ? data.specialties : [];
      const selectedThesis = data.selectedThesis || data.selectedThesisStatement || '';
      const statementText = data.personalStatement || data.finalStatement || '';
      
      console.log('PDF Generation - Using data:', {
        specialtiesCount: specialties.length,
        hasThesis: !!selectedThesis,
        hasStatement: !!statementText,
        statementLength: statementText ? statementText.length : 0
      });
      
      if (!statementText) {
        throw new Error('No personal statement text found in data');
      }
      
      // Create a new PDF document
      const doc = new PDFKit({
        margins: { top: 50, left: 50, right: 50, bottom: 75 }, // Increased bottom margin for footer
        size: 'LETTER',
        bufferPages: true // Enable buffering for page numbering
      });
      
      // Handle pdf internal errors
      doc.on('error', (err) => {
        console.error('PDFKit internal error:', err);
        reject(err);
      });
      
      // Pipe the PDF into the response
      doc.pipe(outputStream);
      
      // Add title
      doc.fontSize(18)
         .font('Helvetica-Bold')
         .text('Personal Statement', { align: 'center' });
      
      // Add specialties if available
      if (specialties.length > 0) {
        doc.moveDown()
           .fontSize(14)
           .font('Helvetica-Bold')
           .text(`Specialties: ${specialties.join(', ')}`);
      }
      
      // Add thesis statement if available
      if (selectedThesis) {
        doc.moveDown()
           .fontSize(12)
           .font('Helvetica-Oblique')
           .text(`Thesis: ${selectedThesis}`);
      }
      
      // Add main content
      doc.moveDown()
         .fontSize(12)
         .font('Helvetica')
         .text(statementText, {
           align: 'left',
           lineGap: 5
         });
      
      // Finalize content before adding footer
      doc.on('pageAdded', () => {
        // Ensure new pages maintain the same margins
        doc.fontSize(12).font('Helvetica');
      });
      
      // Add footer with page numbers at the end after all content
      const range = doc.bufferedPageRange();
      
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        
        // Add footer at the bottom of each page
        const footerY = doc.page.height - 50;
        
        doc.fontSize(10)
           .font('Helvetica')
           .text(
             `Generated by MatchMaker | ${new Date().toLocaleDateString()}`,
             50,
             footerY,
             { align: 'center', width: doc.page.width - 100 }
           );
        
        // Add page number
        doc.text(
          `Page ${i + 1} of ${range.count}`,
          50,
          footerY + 15,
          { align: 'center', width: doc.page.width - 100 }
        );
      }
      
      // Finalize PDF
      doc.end();
      
      console.log('PDF Generation - Document build completed, waiting for stream to finish');
      
      // Handle stream events
      outputStream.on('finish', () => {
        console.log('PDF Generation - Stream finished successfully');
        resolve();
      });
      
      outputStream.on('error', (error) => {
        console.error('PDF Generation - Stream error:', error);
        reject(error);
      });
      
    } catch (error) {
      console.error('PDF Generation - Error:', error);
      reject(error);
    }
  });
};

module.exports = {
  generateApplicationPDF,
  generatePersonalStatementPDF
}; 