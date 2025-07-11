const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRATION = '7d'; // Token expires in 7 days

// Generate JWT token for a user
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRATION
  });
};

// Verify JWT token and return decoded data
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { valid: true, expired: false, id: decoded.id };
  } catch (error) {
    return {
      valid: false,
      expired: error.name === 'TokenExpiredError',
      id: null
    };
  }
};

module.exports = {
  generateToken,
  verifyToken
}; 