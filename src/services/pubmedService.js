const axios = require('axios');

/**
 * Service for interacting with the PubMed API (E-utilities)
 */

// Base URLs for NCBI E-utilities
const ESEARCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
const EFETCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';
const ESUMMARY_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';

// Tool/email parameters for API requests
const DEFAULT_PARAMS = {
  tool: 'matchmaker-app',
  email: 'info@matchmaker.com', // Should be replaced with a real email
  retmode: 'json'
};

/**
 * Search PubMed for articles matching the query
 * @param {string} query - The search query
 * @param {number} limit - Maximum number of results to return
 * @returns {Promise<Object>} - Search results
 */
const searchPubMed = async (query, limit = 10) => {
  try {
    const response = await axios.get(ESEARCH_URL, {
      params: {
        ...DEFAULT_PARAMS,
        db: 'pubmed',
        term: query,
        retmax: limit
      }
    });

    return response.data;
  } catch (error) {
    console.error('PubMed search error:', error);
    throw new Error('Failed to search PubMed');
  }
};

/**
 * Search PubMed using citation information
 * @param {Object} citation - Citation info (title, authors, journal, year)
 * @returns {Promise<string|null>} - PMID if found, null otherwise
 */
const searchPubMedByCitation = async (citation) => {
  if (!citation.title) {
    return null;
  }
  
  try {
    // Build the search query
    let query = `"${citation.title}"[Title]`;
    
    // Add authors if available
    if (citation.authors) {
      // Extract first author's last name
      const firstAuthorMatch = citation.authors.match(/^([A-Za-z-]+)/);
      if (firstAuthorMatch && firstAuthorMatch[1]) {
        query += ` AND ${firstAuthorMatch[1]}[Author]`;
      }
    }
    
    // Add journal if available
    if (citation.journal) {
      query += ` AND "${citation.journal}"[Journal]`;
    }
    
    // Add year if available
    if (citation.yearPublished) {
      query += ` AND ${citation.yearPublished}[Publication Date]`;
    }
    
    // Search PubMed
    const searchResults = await searchPubMed(query, 1);
    
    // Check if we found a matching article
    if (searchResults.esearchresult && 
        searchResults.esearchresult.count > 0 && 
        searchResults.esearchresult.idlist && 
        searchResults.esearchresult.idlist.length > 0) {
      return searchResults.esearchresult.idlist[0];
    }
    
    return null;
  } catch (error) {
    console.error('Error searching PubMed by citation:', error);
    return null;
  }
};

/**
 * Format authors from PubMed to the required format (LastName FirstInitial MiddleInitial)
 * @param {Array} authors - Authors array from PubMed
 * @returns {string} - Formatted author string
 */
const formatAuthors = (authors) => {
  if (!authors || !Array.isArray(authors)) return '';
  
  return authors.map(author => {
    const name = author.name || '';
    const parts = name.split(' ');
    if (parts.length < 2) return name;
    
    const lastName = parts[0];
    const firstInitial = parts[1]?.charAt(0) || '';
    const middleInitial = parts[2]?.charAt(0) || '';
    
    if (middleInitial) {
      return `${lastName} ${firstInitial}${middleInitial}`;
    }
    return `${lastName} ${firstInitial}`;
  }).join(', ');
};

/**
 * Fetch detailed information for a specific PubMed ID
 * @param {string} pmid - PubMed ID
 * @returns {Promise<Object>} - Article details
 */
const getArticleDetails = async (pmid) => {
  try {
    const response = await axios.get(ESUMMARY_URL, {
      params: {
        ...DEFAULT_PARAMS,
        db: 'pubmed',
        id: pmid
      }
    });

    return response.data;
  } catch (error) {
    console.error(`Error fetching PubMed article ${pmid}:`, error);
    throw new Error(`Failed to fetch PubMed article ${pmid}`);
  }
};

/**
 * Fetch full article data for multiple PubMed IDs
 * @param {Array<string>} pmids - Array of PubMed IDs
 * @returns {Promise<Object>} - Articles data
 */
const getArticlesByPMIDs = async (pmids) => {
  if (!pmids || pmids.length === 0) {
    return { result: {} };
  }

  try {
    const response = await axios.get(ESUMMARY_URL, {
      params: {
        ...DEFAULT_PARAMS,
        db: 'pubmed',
        id: pmids.join(',')
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching PubMed articles:', error);
    throw new Error('Failed to fetch PubMed articles');
  }
};

/**
 * Check if a research product is complete based on required fields
 * @param {Object} product - Research product
 * @returns {boolean} - True if the product has all required fields
 */
const isResearchProductComplete = (product) => {
  // Required fields for all research products
  const requiredFields = ['title', 'type', 'status', 'authors'];
  
  // Additional fields for peer-reviewed and non-peer-reviewed types
  const publicationFields = ['journal', 'yearPublished'];
  
  // Check required fields
  const hasRequiredFields = requiredFields.every(field => 
    product[field] && product[field].toString().trim() !== ''
  );
  
  // If it's a publication type, check additional fields
  if (hasRequiredFields && 
      (product.type === 'peer-reviewed' || product.type === 'non-peer-reviewed')) {
    return publicationFields.every(field => 
      product[field] && product[field].toString().trim() !== ''
    );
  }
  
  return hasRequiredFields;
};

/**
 * Enrich a research product with data from PubMed
 * @param {Object} researchProduct - The research product to enrich
 * @returns {Promise<Object>} - Enriched research product
 */
const enrichResearchProduct = async (researchProduct) => {
  let pmid = researchProduct.pmid;
  let enrichedProduct = { ...researchProduct };
  
  // If not a publication type, return as is
  if (researchProduct.type !== 'peer-reviewed' && 
      researchProduct.type !== 'non-peer-reviewed') {
    return {
      ...enrichedProduct,
      isComplete: isResearchProductComplete(enrichedProduct)
    };
  }

  try {
    // If PMID is not available, try to search PubMed by citation
    if (!pmid) {
      pmid = await searchPubMedByCitation(researchProduct);
      if (pmid) {
        enrichedProduct.pmid = pmid;
      } else {
        // If we couldn't find it on PubMed, return with isComplete check
        return {
          ...enrichedProduct,
          isComplete: isResearchProductComplete(enrichedProduct)
        };
      }
    }

    // Fetch article details from PubMed
    const articleData = await getArticleDetails(pmid);
    if (!articleData || !articleData.result || !articleData.result[pmid]) {
      return {
        ...enrichedProduct,
        isComplete: isResearchProductComplete(enrichedProduct)
      };
    }

    const article = articleData.result[pmid];

    // Enrich the research product with PubMed data
    enrichedProduct = {
      ...enrichedProduct,
      title: enrichedProduct.title || article.title,
      journal: enrichedProduct.journal || article.fulljournalname,
      authors: enrichedProduct.authors || formatAuthors(article.authors),
      volume: enrichedProduct.volume || article.volume,
      issueNumber: enrichedProduct.issueNumber || article.issue,
      pages: enrichedProduct.pages || article.pages,
      yearPublished: enrichedProduct.yearPublished || article.pubdate?.split(' ')?.[0],
      pubmedEnriched: true
    };

    // Check if the product is complete after enrichment
    enrichedProduct.isComplete = isResearchProductComplete(enrichedProduct);
    
    return enrichedProduct;
  } catch (error) {
    console.error(`Error enriching research product:`, error);
    return {
      ...enrichedProduct,
      isComplete: isResearchProductComplete(enrichedProduct)
    };
  }
};

module.exports = {
  searchPubMed,
  searchPubMedByCitation,
  getArticleDetails,
  getArticlesByPMIDs,
  enrichResearchProduct,
  isResearchProductComplete,
  formatAuthors
}; 