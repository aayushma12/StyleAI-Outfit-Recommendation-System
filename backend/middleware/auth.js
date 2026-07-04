const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const isSuspended = (user) => user.isBlocked || user.status === 'suspended';

const protect = async (req, res, next) => {
  let token = req.cookies?.token;
  if (!token && req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      return res.status(401).json({ message: 'User not found' });
    }
    if (isSuspended(req.user)) {
      return res.status(403).json({ message: 'Your account has been suspended. Please contact support.' });
    }
    next();
  } catch {
    return res.status(401).json({ message: 'Not authorized, token invalid' });
  }
};

// Attaches user if a valid token is present; continues without error if not.
// Use on public endpoints that behave differently for authenticated users.
const optionalAuth = async (req, res, next) => {
  let token = req.cookies?.token;
  if (!token && req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    req.user = (user && !isSuspended(user)) ? user : null;
  } catch {
    req.user = null;
  }
  next();
};

module.exports = { protect, optionalAuth };
