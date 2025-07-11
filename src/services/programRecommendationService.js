const openai = require('../config/openai');

// Generate program recommendations based on user preferences
const generateProgramRecommendations = async (preferences) => {
  try {
    const systemPrompt = `You are an AI assistant specialized in helping medical students find residency programs that match their preferences.`;
    
    let prompt = `Based on the following preferences, recommend 5-10 residency programs that would be good matches for a medical student. For each program, provide the program name, location, and a brief explanation of why it's a good match.

Primary Specialty: ${preferences.primarySpecialty}
${preferences.otherSpecialties.length > 0 ? `Other Specialties of Interest: ${preferences.otherSpecialties.join(', ')}` : ''}
Preferred States: ${preferences.preferredStates.join(', ')}
Hospital Preference: ${preferences.hospitalPreference === 'academic' ? 'Academic Centers' : 'Community-Level Hospitals'}
Resident Count Preference: ${preferences.residentCountPreference === 'many' ? 'Programs with Many Residents' : 'Programs with Fewer Residents'}
Valued Program Characteristics: ${preferences.valuedCharacteristics.join(', ')}

For each recommended program, provide:
1. Program name and institution
2. Location (city, state)
3. Program type (academic/community)
4. Approximate number of residents per year
5. A brief explanation of why this program matches the student's preferences (2-3 sentences)

Format the response as a JSON array of program objects.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    
    // Parse the JSON response
    const parsedResponse = JSON.parse(content);
    
    // Return the program recommendations
    return parsedResponse.programs || [];
  } catch (error) {
    console.error('Error generating program recommendations:', error);
    throw new Error('Failed to generate program recommendations');
  }
};

module.exports = {
  generateProgramRecommendations
}; 