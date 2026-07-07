const AppFeedback   = require('../models/AppFeedback');
const User          = require('../models/User');
const WardrobeCombo = require('../models/WardrobeCombo');

exports.submitAppFeedback = async (req, res) => {
  const { type, subject, message, recommendationRating, satisfactionRating, wouldRecommend } = req.body;

  if (!type || !message?.trim()) {
    return res.status(400).json({ message: 'Type and message are required.' });
  }
  if (message.trim().length < 10) {
    return res.status(400).json({ message: 'Feedback message must be at least 10 characters.' });
  }
  if (message.trim().length > 1000) {
    return res.status(400).json({ message: 'Feedback message cannot exceed 1000 characters.' });
  }

  // Must match AppFeedback.js's schema enum exactly (and what FeedbackView.jsx
  // actually offers) — this previously listed 'bug'/'compliment'/'other',
  // none of which the schema accepts, so a submission with any of those
  // values would pass this check and then crash with an uncaught Mongoose
  // ValidationError at .create() below instead of a clean 400.
  const VALID_TYPES = ['suggestion', 'complaint', 'improvement'];
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ message: 'Invalid feedback type.' });
  }

  const feedback = await AppFeedback.create({
    user: req.user._id,
    type,
    subject: subject?.trim().slice(0, 120) || '',
    message: message.trim(),
    recommendationRating: recommendationRating ? Math.min(5, Math.max(1, Number(recommendationRating))) : undefined,
    satisfactionRating:   satisfactionRating   ? Math.min(5, Math.max(1, Number(satisfactionRating)))   : undefined,
    wouldRecommend,
  });

  res.status(201).json({ feedback, message: 'Feedback submitted successfully!' });
};

exports.getAppFeedback = async (req, res) => {
  const feedbacks = await AppFeedback.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(20);

  res.json({ feedbacks, count: feedbacks.length });
};

exports.getPublicTestimonials = async (req, res) => {
  const testimonials = await AppFeedback.find({
    isPublic: true,
    message: { $exists: true, $ne: '' },
  })
    .populate('user', 'name')
    .sort({ createdAt: -1 })
    .limit(6);

  res.json({
    testimonials: testimonials.map(t => ({
      id: t._id,
      name: t.user?.name?.split(' ')[0] || 'StyleAI User', // First name only for privacy
      message: t.message,
      rating: t.satisfactionRating || null,
      type: t.type,
      date: t.createdAt,
    })),
  });
};

exports.getPublicStats = async (req, res) => {
  try {
    const [userCount, outfitCount] = await Promise.all([
      User.countDocuments({ role: 'user', onboardingCompleted: true }),
      WardrobeCombo.countDocuments({}),
    ]);
    res.json({ userCount, outfitCount, occasionsCount: 8 });
  } catch {
    res.status(500).json({ message: 'Could not fetch stats' });
  }
};
