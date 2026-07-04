'use strict';

const mongoose = require('mongoose');

/**
 * Rejects a route with a clean 400 if `req.params[paramName]` isn't a valid
 * Mongo ObjectId, instead of letting Mongoose throw a CastError deep inside
 * a query — which express-async-errors would otherwise surface as an
 * unhandled 500 with a raw driver error message.
 */
module.exports = function validateObjectId(paramName = 'id') {
  return (req, res, next) => {
    if (!mongoose.Types.ObjectId.isValid(req.params[paramName])) {
      return res.status(400).json({ message: `Invalid ${paramName}.` });
    }
    next();
  };
};
