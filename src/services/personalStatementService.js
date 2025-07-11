const openai = require('../config/openai');

// Generate thesis statements based on user inputs
const generateThesisStatements = async (specialties, motivation, characteristics, stories) => {
  try {
    const systemPrompt = `You are an expert medical school advisor helping students craft compelling personal statements for residency applications.`;
    
    let prompt = `Based on the following information about a medical student applying for ${specialties.join(', ')} residency, generate 5 distinct thesis statements (1-2 sentences each) that could serve as the central theme for their personal statement.

Motivation for choosing this specialty: ${motivation}

Three characteristics they want to highlight:
${characteristics.map((c, i) => `${i+1}. ${c}`).join('\n')}

Stories that demonstrate these characteristics:
${stories.map((s, i) => `For "${s.characteristic}": ${s.story}`).join('\n\n')}

Each thesis statement should:
1. Connect their motivation with their qualities
2. Highlight what makes them a good fit for the specialty
3. Be concise (1-2 sentences)
4. Be distinct from the other statements
5. Be personal and authentic

Please format your response as a numbered list of 5 thesis statements only, without explanations or additional text.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    // Extract and clean the thesis statements from the response
    const content = response.choices[0].message.content;
    const statements = content
      .split(/\d+\./)
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);

    return statements;
  } catch (error) {
    console.error('Error generating thesis statements:', error);
    throw new Error('Failed to generate thesis statements');
  }
};

// Generate the complete personal statement
const generateFinalStatement = async (
  specialties,
  motivation,
  characteristics,
  stories,
  thesisStatement
) => {
  try {
    const systemPrompt = `You are an expert medical school advisor helping students craft compelling personal statements for residency applications.`;
    
    let prompt = `Create a compelling personal statement for a medical student applying to ${specialties.join(', ')} residency programs. Use the following thesis statement as the central theme:

"${thesisStatement}"

Motivation for choosing this specialty: ${motivation}

Three characteristics they want to highlight:
${characteristics.map((c, i) => `${i+1}. ${c}`).join('\n')}

Stories that demonstrate these characteristics:
${stories.map((s, i) => `For "${s.characteristic}": ${s.story}`).join('\n\n')}

Please format the personal statement with the following structure:
- Paragraph 1: Introduction that hooks the reader and introduces the applicant's desire to pursue ${specialties.join(', ')}. Include the thesis statement.
- Paragraph 2: Elaborate on the first characteristic (${characteristics[0]}) with specific examples from their experience.
- Paragraph 3: Elaborate on the second characteristic (${characteristics[1]}) with specific examples from their experience.
- Paragraph 4: Elaborate on the third characteristic (${characteristics[2]}) with specific examples from their experience.
- Paragraph 5: Conclusion that ties everything together, emphasizes why they are an ideal candidate, and shows excitement for the future in this specialty.

Keep the statement concise, authentic, and focused on what makes the applicant unique. Aim for approximately 700-800 words total.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    const finalStatement = response.choices[0].message.content;
    
    // Count the approximate number of words
    const wordCount = finalStatement.split(/\s+/).length;

    return {
      finalStatement,
      wordCount
    };
  } catch (error) {
    console.error('Error generating final statement:', error);
    throw new Error('Failed to generate final personal statement');
  }
};

module.exports = {
  generateThesisStatements,
  generateFinalStatement
}; 