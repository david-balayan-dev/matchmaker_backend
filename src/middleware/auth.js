const jwt = require('jsonwebtoken');
const asyncHandler = require('./async');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');

// Protect routes
exports.protect = asyncHandler(async (req, res, next) => {
  let token;
  
  console.log("Auth middleware headers:", JSON.stringify(req.headers));

  // Get token from authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // Set token from Bearer token
    token = req.headers.authorization.split(' ')[1];
    console.log("Token found in Authorization header:", token ? token.substring(0, 10) + '...' : 'none');
  }
  // Uncomment below if you want to store token in cookie
  // else if (req.cookies.token) {
  //   token = req.cookies.token;
  // }

  // Make sure token exists
  if (!token) {
    console.error("No token found in request headers");
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }

  try {
    // Verify token
    console.log("JWT_SECRET available:", !!process.env.JWT_SECRET);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Token decoded successfully, user ID:", decoded.id);

    // Set the user in req.user
    const user = await User.findById(decoded.id);
    
    if (!user) {
      console.error(`User with ID ${decoded.id} not found in database`);
      return next(new ErrorResponse('User not found', 404));
    }
    
    console.log(`User authenticated: ${user.firstName} ${user.lastName} (${user.email})`);
    req.user = user;

    next();
  } catch (err) {
    console.error("Token verification failed:", err.message);
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }
});

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorResponse(
          `User role '${req.user.role}' is not authorized to access this route`,
          403
        )
      );
    }
    next();
  };
}; 