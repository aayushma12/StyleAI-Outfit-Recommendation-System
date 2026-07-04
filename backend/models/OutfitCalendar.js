const mongoose = require('mongoose');

const outfitCalendarSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:        { type: Date, required: true },
  outfitName:  { type: String, trim: true, default: '' },
  combo:       { type: mongoose.Schema.Types.ObjectId, ref: 'WardrobeCombo', default: null },
  occasion:    { type: String, trim: true, default: '' },
  notes:       { type: String, trim: true, maxlength: 500, default: '' },
  aiSuggested: { type: Boolean, default: false },
  aiReasons:   [{ type: String }],
  weather:     { temp: Number, condition: String },
}, { timestamps: true });

outfitCalendarSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('OutfitCalendar', outfitCalendarSchema);
