const OutfitCalendar = require('../models/OutfitCalendar');
const WardrobeCombo  = require('../models/WardrobeCombo');
const logActivity    = require('../utils/historyLogger');
const { logBehavior } = require('../services/behaviorService');

const toUTCDay = (d) => {
  const dt = new Date(d);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
};

const fmtDate = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// GET /api/calendar?year=2025&month=6  (month is 1-based)
exports.getMonthEntries = async (req, res) => {
  try {
    const y = parseInt(req.query.year,  10);
    const m = parseInt(req.query.month, 10) - 1;
    if (isNaN(y) || isNaN(m)) return res.status(400).json({ message: 'year and month required' });
    const start = new Date(Date.UTC(y, m, 1));
    const end   = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
    const entries = await OutfitCalendar.find({ user: req.user._id, date: { $gte: start, $lte: end } })
      .sort({ date: 1 })
      .populate('combo', 'name matchScore occasion');
    res.json({ entries });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/calendar/week?date=2025-06-16
exports.getWeekEntries = async (req, res) => {
  try {
    const base   = new Date(req.query.date || Date.now());
    const dow    = base.getUTCDay();
    const monday = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() - ((dow + 6) % 7)));
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    sunday.setUTCHours(23, 59, 59, 999);
    const entries = await OutfitCalendar.find({ user: req.user._id, date: { $gte: monday, $lte: sunday } })
      .sort({ date: 1 })
      .populate('combo', 'name matchScore occasion');
    res.json({ entries });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/calendar/upcoming?days=14
exports.getUpcoming = async (req, res) => {
  try {
    const days  = Math.min(parseInt(req.query.days || 14, 10), 30);
    const today = toUTCDay(new Date());
    const end   = new Date(today);
    end.setUTCDate(today.getUTCDate() + days - 1);
    end.setUTCHours(23, 59, 59, 999);
    const entries = await OutfitCalendar.find({ user: req.user._id, date: { $gte: today, $lte: end } })
      .sort({ date: 1 })
      .populate('combo', 'name matchScore occasion');
    res.json({ entries });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/calendar  (upsert by date)
exports.upsertEntry = async (req, res) => {
  try {
    const { date, outfitName, combo, occasion, notes, aiSuggested, aiReasons, weather } = req.body;
    if (!date) return res.status(400).json({ message: 'date is required' });
    const day = toUTCDay(date);

    const existing = await OutfitCalendar.findOne({ user: req.user._id, date: day });
    const isUpdate = !!existing;

    const entry = await OutfitCalendar.findOneAndUpdate(
      { user: req.user._id, date: day },
      {
        outfitName:  outfitName  || '',
        combo:       combo       || null,
        occasion:    occasion    || '',
        notes:       notes       || '',
        aiSuggested: !!aiSuggested,
        aiReasons:   aiReasons   || [],
        weather:     weather     || {},
      },
      { new: true, upsert: true, runValidators: true }
    ).populate('combo', 'name matchScore occasion');

    logActivity(req.user._id, {
      action: isUpdate ? 'calendar_updated' : 'calendar_scheduled',
      category: 'calendar',
      title: isUpdate
        ? `Updated calendar entry for ${fmtDate(day)}`
        : `Scheduled "${outfitName || 'outfit'}" for ${fmtDate(day)}`,
      description: `${outfitName || 'Outfit'}${occasion ? ' · ' + occasion : ''}${aiSuggested ? ' · AI suggested' : ''}`,
      metadata: { outfitName: outfitName || '', occasion: occasion || '', date: fmtDate(day) },
      refId: entry._id,
    });

    // Scheduling a real saved outfit is a positive behavioral signal too —
    // without this, getRecentlyRecommendedItemIds() never learns about
    // outfits the user has committed to wearing on a specific day, and the
    // diversity engine could re-suggest the exact same combination.
    if (combo) {
      const comboDoc = await WardrobeCombo.findById(combo).select('items').lean();
      if (comboDoc?.items?.length) {
        logBehavior(req.user._id, 'outfit_save', {
          entityId: combo, entityType: 'WardrobeCombo',
          metadata: { itemIds: comboDoc.items, source: isUpdate ? 'calendar_updated' : 'calendar_scheduled' },
        });
      }
    }

    res.json({ entry });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// DELETE /api/calendar/:id
exports.deleteEntry = async (req, res) => {
  try {
    const entry = await OutfitCalendar.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!entry) return res.status(404).json({ message: 'Entry not found.' });

    logActivity(req.user._id, {
      action: 'calendar_removed', category: 'calendar',
      title: `Removed calendar entry for ${fmtDate(entry.date)}`,
      description: entry.outfitName || 'Outfit removed from calendar',
      metadata: { outfitName: entry.outfitName, date: fmtDate(entry.date) },
    });

    res.json({ message: 'Entry deleted.' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/calendar/suggest?date=2025-06-15&occasion=college
exports.aiSuggest = async (req, res) => {
  try {
    const targetOcc = (req.query.occasion || '').toLowerCase();
    const combos = await WardrobeCombo.find({ user: req.user._id })
      .populate('items', 'category color style occasions seasons');

    // A combo's items array can hold a null slot for a wardrobe item deleted
    // after the combo was saved (.populate() nulls stale refs in place) —
    // strip those before scoring so `i.occasions`/`i.style` below never
    // dereferences null.
    combos.forEach(combo => { combo.items = (combo.items || []).filter(Boolean); });

    if (!combos.length) return res.json({ suggestions: [] });

    const stylePrefs   = (req.user.stylePreferences   || []).map(s => s.toLowerCase());
    const occasionPrefs = (req.user.occasionPreferences || []).map(o => o.toLowerCase());

    const scored = combos.map(combo => {
      let score = combo.matchScore || 0;
      const comboOcc = (combo.occasion || '').toLowerCase();

      if (targetOcc && comboOcc) {
        if (comboOcc === targetOcc || comboOcc.includes(targetOcc) || targetOcc.includes(comboOcc)) score += 30;
      }
      if (occasionPrefs.some(o => comboOcc.includes(o))) score += 10;
      if (combo.isLiked) score += 15;

      if (combo.items && combo.items.length) {
        const itemOccs = combo.items.flatMap(i => (i.occasions || []).map(x => x.toLowerCase()));
        if (targetOcc && itemOccs.some(o => o.includes(targetOcc) || targetOcc.includes(o))) score += 20;

        if (stylePrefs.length) {
          const styles = combo.items.map(i => (i.style || '').toLowerCase()).filter(Boolean);
          const matches = styles.filter(s => stylePrefs.some(p => p.includes(s) || s.includes(p)));
          score += matches.length * 8;
        }
      }

      const reasons = [];
      if (combo.matchScore >= 75) reasons.push(`High match score (${combo.matchScore}%)`);
      if (targetOcc && comboOcc.includes(targetOcc)) reasons.push(`Suitable for ${req.query.occasion}`);
      if (combo.isLiked) reasons.push('Previously liked');
      if (combo.weatherSuitable) reasons.push(`Weather: ${combo.weatherSuitable}`);
      if (combo.reasons && combo.reasons.length) reasons.push(combo.reasons[0]);

      return { combo, score, reasons: reasons.slice(0, 3) };
    });

    scored.sort((a, b) => b.score - a.score);
    const suggestions = scored.slice(0, 3).map(({ combo, score, reasons }) => ({
      _id:        combo._id,
      name:       combo.name || 'Unnamed Combo',
      occasion:   combo.occasion,
      matchScore: combo.matchScore,
      score,
      reasons,
    }));

    res.json({ suggestions });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
