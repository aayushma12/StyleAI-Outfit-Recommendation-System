const EvaluationResponse = require('../models/EvaluationResponse');

const LIKERT_FIELDS = ['recommendationQuality', 'easeOfUse', 'visualDesign', 'systemSpeed', 'overallSatisfaction'];

exports.submitEvaluation = async (req, res) => {
  const { participantLabel, comments } = req.body;

  const ratings = {};
  for (const field of LIKERT_FIELDS) {
    const val = Number(req.body[field]);
    if (!Number.isInteger(val) || val < 1 || val > 5) {
      return res.status(400).json({ message: `${field} must be an integer between 1 and 5.` });
    }
    ratings[field] = val;
  }

  const response = await EvaluationResponse.create({
    ...ratings,
    participantLabel: participantLabel?.trim().slice(0, 80) || '',
    comments: comments?.trim().slice(0, 1000) || '',
  });

  res.status(201).json({ response, message: 'Thank you for your feedback!' });
};
