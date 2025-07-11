/**
 * OpenAI Service - Handles integration with OpenAI API
 */
const OpenAI = require('openai');

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate thesis statements for personal statement
 * @param {Object} data - Data about the applicant and their characteristics
 * @returns {Promise<Array>} - Array of thesis statements
 */
const generateThesisStatements = async (data) => {
  try {
    const { specialties, reason, characteristics, experiences } = data;
    
    const prompt = `
      Generate 5 unique and compelling thesis statements for a medical residency personal statement. 
      Each statement should be 1-2 sentences and serve as a theme for the applicant's personal statement.
      
      Applicant is applying for: ${specialties.join(', ')}
      Reason for choosing this specialty: ${reason}
      Key characteristics to highlight: ${characteristics.join(', ')}
      
      Experiences that demonstrate these characteristics:
      - ${characteristics[0]}: ${experiences[0]}
      - ${characteristics[1]}: ${experiences[1]}
      - ${characteristics[2]}: ${experiences[2]}
      
      Make each thesis statement unique in approach and differentiating. Each should be concise (1-2 sentences) 
      and convey why the applicant would be an excellent fit for the chosen specialty.
    `;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are an expert medical school advisor helping craft compelling personal statements for residency applications." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500
    });
    
    // Parse the response to extract the 5 thesis statements
    const content = response.choices[0].message.content;
    const statements = content.split(/\d+\./).filter(Boolean).map(s => s.trim());
    
    return statements.slice(0, 5); // Ensure we return exactly 5 statements
  } catch (error) {
    console.error('Error generating thesis statements:', error);
    throw new Error('Failed to generate thesis statements');
  }
};

/**
 * Generate a complete personal statement draft
 * @param {Object} data - All data needed for the personal statement
 * @returns {Promise<String>} - Complete personal statement draft
 */
const generatePersonalStatement = async (data) => {
  try {
    const { 
      specialties, 
      reason, 
      characteristics, 
      experiences,
      selectedThesis 
    } = data;
    
    const prompt = `
      Write a complete personal statement for a medical residency application. 
      The statement should be no more than 750 words and follow this structure:
      
      - Paragraph 1: Introduction about the applicant and their desire to apply to ${specialties.join(', ')}. 
        Include this thesis statement: "${selectedThesis}"
      
      - Paragraph 2: Describe how the applicant demonstrates the characteristic "${characteristics[0]}" 
        using this experience: "${experiences[0]}"
      
      - Paragraph 3: Describe how the applicant demonstrates the characteristic "${characteristics[1]}" 
        using this experience: "${experiences[1]}"
      
      - Paragraph 4: Describe how the applicant demonstrates the characteristic "${characteristics[2]}" 
        using this experience: "${experiences[2]}"
      
      - Paragraph 5: Conclusion showing excitement for residency and why they are an ideal candidate.
      
      Additional context on why they chose this specialty: "${reason}"
      
      Make the statement compelling, authentic, and within the 750-word limit.
    `;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are an expert medical school advisor helping craft compelling personal statements for residency applications." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });
    
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating personal statement:', error);
    throw new Error('Failed to generate personal statement');
  }
};

module.exports = {
  generateThesisStatements,
  generatePersonalStatement
}; 