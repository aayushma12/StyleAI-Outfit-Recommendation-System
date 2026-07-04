// Restricts route to administrators only. Must be used after `protect`.
exports.adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }
  next();
};

// Restricts route to regular registered users only. Must be used after `protect`.
exports.userOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  if (req.user.role !== 'user') {
    return res.status(403).json({ message: 'This action is only available to registered users.' });
  }
  next();
};
