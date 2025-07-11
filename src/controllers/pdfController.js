/**
 * Controller for PDF generation endpoints
 */
const pdfService = require('../services/pdfService');

/**
 * Generate a personal statement PDF
 */
const generatePersonalStatementPDF = async (req, res) => {
  console.log('PDF Controller - Received request to generate personal statement PDF');
  
  try {
    // Validate request
    if (!req.body) {
      console.error('PDF Controller - No body provided in request');
      return res.status(400).json({ error: 'No data provided' });
    }
    
    console.log('PDF Controller - Personal statement data available, generating PDF');
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="personal_statement.pdf"');
    
    // Generate PDF and pipe to response
    await pdfService.generatePersonalStatementPDF(req.body, res);
    
    console.log('PDF Controller - PDF generation completed');
    
    // Note: We don't need to call res.end() here as the PDF service already closes the stream
  } catch (error) {
    console.error('PDF Controller - Error:', error.message);
    
    // Only send error if headers haven't been sent yet
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Error generating PDF', 
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    } else {
      // If headers were already sent, we need to destroy the response
      // to prevent hanging connections
      res.destroy();
    }
  }
};

module.exports = {
  generatePersonalStatementPDF
}; 