const openai = require('../config/openai');

// Extract research products from CV text
const extractResearchProducts = async (cvText) => {
  try {
    if (!cvText || typeof cvText !== 'string' || cvText.trim().length === 0) {
      throw new Error('Invalid CV text provided');
    }

    const systemPrompt = `You are an AI assistant specialized in extracting research publications, abstracts, presentations, and other research products from medical CVs. Your task is to carefully analyze the CV text and extract all research-related entries, including:
- Peer-reviewed publications
- Non-peer-reviewed publications
- Conference presentations (oral and poster)
- Abstracts
- Research projects
- Patents
- Book chapters
- Other research outputs

Be especially careful to identify and extract PubMed IDs (PMID) when present. Look for patterns like "PMID: 12345678" or similar formats.`;

    let prompt = `Please analyze the following CV text and extract all research products. For each research product, identify:

1. Title (required)
2. Type (choose one):
   - peer-reviewed
   - non-peer-reviewed
   - poster
   - oral
   - abstract
   - patent
   - book-chapter
   - other
3. Status (choose one):
   - published
   - submitted
   - accepted
   - in-progress
4. Authors (format: LastName FirstInitial MiddleInitial without periods or commas)
5. Journal name (if applicable)
6. Publication volume (if applicable)
7. Issue number (if applicable)
8. Pages (if applicable)
9. PMID (if applicable) - look for patterns like "PMID: 12345678"
10. Month published (if applicable)
11. Year published (if applicable)
12. Conference name (if applicable)
13. Conference location (if applicable)
14. Conference date (if applicable)

Important guidelines:
- Look for sections titled "Publications", "Research", "Presentations", etc.
- Extract all research products, even if some fields are missing
- If a research product is missing some details (e.g., journal, year), include it as long as it has a title and at least one author.
- For conference presentations, include the conference details
- For patents, include patent numbers if available
- For book chapters, include the book title and editors
- If no research products are found, return an empty array

IMPORTANT: Always return a single JSON object with a key 'researchProducts' (not an array of objects). Example: { "researchProducts": [ ... ] }
If no research products are found, return: { "researchProducts": [] }

Format the response as a JSON object with key "researchProducts". If a field is not available, use null.

CV Text:
${cvText}`;

    console.log('Extracting research products from CV text');
    
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Use a more widely available model
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 2000
      // Removed response_format parameter since it's not supported by all models
    });

    const content = response.choices[0].message.content;
    
    if (!content) {
      throw new Error('No content received from OpenAI');
    }
    
    console.log('Received response for research products extraction:', content.substring(0, 200) + '...');

    // Try to parse the response as JSON
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(content);
      console.log('Successfully parsed research products JSON response');
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      console.log('Raw response:', content);
      return [];
    }

    // Handle both { researchProducts: [...] } and [ { researchProducts: [...] } ]
    if (Array.isArray(parsedResponse)) {
      const found = parsedResponse.find(obj => Array.isArray(obj.researchProducts));
      if (found) {
        console.log(`Found ${found.researchProducts.length} research products in array response`);
        return found.researchProducts;
      }
      console.log('No research products found in array response');
      return [];
    } else if (parsedResponse && Array.isArray(parsedResponse.researchProducts)) {
      console.log(`Found ${parsedResponse.researchProducts.length} research products in object response`);
      return parsedResponse.researchProducts;
    }

    // Handle plain text response
    if (typeof content === 'string' && (content.toLowerCase().includes('no research products') || 
        content.toLowerCase().includes('does not contain any research products'))) {
      console.log('No research products found in CV');
      return [];
    }

    // If we get here, the response is unexpected
    console.error('Unexpected response format:', content);
    return [];
  } catch (error) {
    console.error('Error extracting research products:', error);
    return [];
  }
};

// Extract experiences from CV text
const extractExperiences = async (cvText) => {
  try {
    console.log('CV Parsing: Starting experience extraction');
    console.log(`CV text length: ${cvText?.length || 0} characters`);
    console.log('CV text sample:', cvText?.substring(0, 200) + '...');
    
    if (!cvText || typeof cvText !== 'string' || cvText.trim().length === 0) {
      console.error('CV Parsing: Invalid CV text provided');
      throw new Error('Invalid CV text provided');
    }
    
    const systemPrompt = `You are an AI assistant specialized in extracting professional experiences from medical CVs.`;
    
    let prompt = `Extract all professional experiences from the following CV text. For each experience, identify the following information:

1. Organization (university, hospital, company, etc.)
2. Experience Type (e.g., clinical, research, volunteer, leadership, education)
3. Position Title
4. Department (if available)
5. Start Date (use format YYYY-MM if possible, or just YYYY if month is unknown)
6. End Date (use format YYYY-MM, YYYY, or "Present" if it's current)
7. Country
8. State/Province
9. Participation Frequency (e.g., full-time, part-time)
10. Setting (e.g., hospital, clinic, laboratory, university)
11. Focus Area or Field
12. Description of responsibilities and achievements

Pay special attention to:
- Extract the department or division within the organization if available
- Correctly identify if an experience is ongoing/current
- Properly format dates as YYYY-MM when both year and month are available
- Extract location information (country, state) from the text

Format the output as a JSON array of experience objects. Each experience object should have these exact fields:
{
  "organization": "",
  "experienceType": "",
  "positionTitle": "",
  "department": "",
  "startDate": "",
  "endDate": "",
  "country": "",
  "state": "",
  "participationFrequency": "",
  "setting": "",
  "focusArea": "",
  "description": ""
}

CV Text:
${cvText}`;

    console.log('CV Parsing: Sending request to OpenAI');
    
    try {
      console.log('CV Parsing: Using OpenAI API with key:', process.env.OPENAI_API_KEY ? 'Key exists' : 'NO KEY FOUND');
      
      // Use the correct OpenAI API method for chat completions
      // Either use gpt-4-turbo which supports response_format or remove response_format for gpt-4
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo", // Use a more widely available model
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 4000,
        temperature: 0.3
        // Removed response_format parameter since it's not supported by all models
      });
    
      console.log('CV Parsing: Received response from OpenAI');
      const responseContent = response.choices[0].message.content;
      console.log('CV Parsing: Response content sample:', responseContent.substring(0, 200) + '...');
      
      let experiences = [];
      
      try {
        // Try to extract JSON from the text
        let jsonStr = responseContent;
        
        // Look for JSON in the response
        const jsonRegex = /```json\s*([\s\S]*?)\s*```|```\s*([\s\S]*?)\s*```|\{[\s\S]*\}|\[[\s\S]*\]/m;
        const match = responseContent.match(jsonRegex);
        if (match) {
          jsonStr = match[1] || match[2] || match[0];
          console.log('CV Parsing: Extracted JSON-like content:', jsonStr.substring(0, 100) + '...');
        }
        
        // Clean up the extracted JSON string
        jsonStr = jsonStr.trim().replace(/^```json|```$/g, '').trim();
        
        // First try parsing the entire response as JSON
        let parsed;
        try {
          parsed = JSON.parse(jsonStr);
          console.log('CV Parsing: Successfully parsed JSON response:', JSON.stringify(parsed).substring(0, 200) + '...');
        } catch (initialParseError) {
          console.log('CV Parsing: Initial JSON parse failed, trying to find valid JSON in the response');
          
          // Look for complete JSON objects
          const objRegex = /\{[\s\S]*?\}/g;
          const objMatches = jsonStr.match(objRegex);
          
          if (objMatches && objMatches.length > 0) {
            console.log(`CV Parsing: Found ${objMatches.length} potential JSON objects`);
            try {
              // Try to combine them into an array
              parsed = JSON.parse('[' + objMatches.join(',') + ']');
            } catch (e) {
              // Try each object individually
              parsed = { experiences: [] };
              for (const objStr of objMatches) {
                try {
                  const obj = JSON.parse(objStr);
                  parsed.experiences.push(obj);
                } catch (innerError) {
                  console.log('CV Parsing: Failed to parse individual object:', objStr.substring(0, 50) + '...');
                }
              }
            }
          }
        }
        
        // Extract experiences from the parsed JSON
        if (parsed) {
          // Check if the JSON has an experiences array
          if (parsed.experiences && Array.isArray(parsed.experiences)) {
            experiences = parsed.experiences;
            console.log('CV Parsing: Found experiences array in parsed JSON');
          } else if (Array.isArray(parsed)) {
            // Maybe the array is directly returned
            experiences = parsed;
            console.log('CV Parsing: Using parsed array directly');
          } else {
            // Look for any array inside the JSON
            console.log('CV Parsing: Looking for arrays in parsed JSON keys:', Object.keys(parsed));
            for (const key in parsed) {
              if (Array.isArray(parsed[key])) {
                experiences = parsed[key];
                console.log(`CV Parsing: Found array in key '${key}'`);
                break;
              }
            }
          }
        }
        
        // If we couldn't extract experiences through parsing, use regex to extract structured data
        if (!experiences || experiences.length === 0) {
          console.log('CV Parsing: No experiences found in JSON, attempting regex extraction');
          
          // This regex looks for patterns like "Organization: XYZ" followed by other fields
          const expRegex = /Organization:?[\s\n]*([^\n]+)(?:[\s\n]+(?:Experience Type|Position|Title):?[\s\n]*([^\n]+))?(?:[\s\n]+(?:Position|Title):?[\s\n]*([^\n]+))?/gim;
          
          let match;
          while ((match = expRegex.exec(responseContent)) !== null) {
            experiences.push({
              organization: match[1]?.trim() || "Unknown Organization",
              experienceType: match[2]?.trim() || "Unknown Type",
              positionTitle: match[3]?.trim() || match[2]?.trim() || "Unknown Position",
              startDate: "",
              endDate: "",
              country: "USA",
              state: "",
              participationFrequency: "Full-time",
              setting: "",
              focusArea: "",
              description: "Extracted from resume text. Please edit with actual details."
            });
          }
        }
        
        console.log(`CV Parsing: Successfully parsed ${experiences.length} experiences`);
      } catch (parseError) {
        console.error('CV Parsing: JSON parse error:', parseError);
        console.error('CV Parsing: Raw response content:', responseContent);
        
        // Try to extract anything that looks like JSON from the text
        try {
          const jsonMatch = responseContent.match(/\[\s*\{.*\}\s*\]/s);
          if (jsonMatch) {
            experiences = JSON.parse(jsonMatch[0]);
            console.log(`CV Parsing: Extracted JSON array with ${experiences.length} experiences`);
          }
        } catch (fallbackError) {
          console.error('CV Parsing: Fallback extraction failed:', fallbackError);
          throw new Error('Failed to parse experiences from AI response');
        }
      }
      
      return experiences;
    } catch (openaiError) {
      console.error('CV Parsing: OpenAI API error:', openaiError);
      throw new Error(`OpenAI API error: ${openaiError.message}`);
    }
  } catch (error) {
    console.error('CV Parsing error:', error);
    return []; // Return empty array instead of throwing to avoid breaking the application
  }
};

// Generate expanded description for meaningful experiences
const generateExpandedDescription = async (experience) => {
  try {
    const systemPrompt = `You are an AI assistant specialized in helping medical students highlight their most meaningful experiences for residency applications.`;
    
    let prompt = `Create an expanded description (maximum 300 characters) for a medical student's most meaningful experience. This expanded description should explain why this experience was particularly significant for their personal and professional growth, and how it contributes to their future medical career.

Experience details:
- Organization: ${experience.organization}
- Position: ${experience.positionTitle}
- Type: ${experience.experienceType}
- Original description: ${experience.description}

Your expanded description should:
1. Be concise (max 300 characters)
2. Highlight personal growth and insights gained
3. Connect the experience to their future goals in medicine
4. Be written in first person
5. Avoid simply repeating information from the original description`;

    console.log('Generating expanded description for experience:', experience.positionTitle);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 350
    });

    const expandedDescription = response.choices[0].message.content.trim();
    console.log('Generated expanded description:', expandedDescription);
    
    // Ensure the description is no longer than 300 characters
    return expandedDescription.length > 300 
      ? expandedDescription.substring(0, 297) + '...' 
      : expandedDescription;
  } catch (error) {
    console.error('Error generating expanded description:', error);
    throw new Error('Failed to generate expanded description');
  }
};

module.exports = {
  extractResearchProducts,
  extractExperiences,
  generateExpandedDescription
}; 