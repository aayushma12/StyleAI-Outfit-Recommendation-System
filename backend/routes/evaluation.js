const express = require('express');
const router = express.Router();
const { submitEvaluation } = require('../controllers/evaluationController');

router.post('/', submitEvaluation);

module.exports = router;
