'use strict';

// ── Explainable AI ────────────────────────────────────────────────────────
// Every recommendation gets a template explanation grounded in its ACTUAL
// computed scores — always present, always numerically consistent with what's
// displayed, and free (no LLM call). If a text provider is configured, ONE
// extra call rewrites the prose warmly for the whole session; if it fails,
// returns malformed JSON, or doesn't match the expected shape, the template
// is kept untouched. An LLM failure never degrades a session's correctness.

const scoring    = require('./scoringService');
const aiProvider = require('./aiProviderService');

const EXPLANATION_FIELDS = [
  'summary', 'styleReason', 'colorReason', 'occasionReason',
  'weatherReason', 'behaviorReason', 'wardrobeReason', 'calendarReason',
];

function harmonyLabel(pct) {
  if (pct >= 90) return 'a striking, well-balanced';
  if (pct >= 78) return 'a clean, coordinated';
  if (pct >= 62) return 'a workable';
  if (pct >= 45) return 'an unconventional but wearable';
  return 'a bold, high-contrast';
}

function buildTemplateExplanation(scoredEntry, categoryKey, user, context) {
  const { subScores, breakdown, outfitItems, candidate } = scoredEntry;
  const occasion = context.occasion || 'today';
  const userStyles = [...(user.stylePreferences || []), ...(user.fashionStyles || [])];

  const summary = scoring.generateScoreNarrative(subScores, categoryKey, { occasion });

  const styleReason = breakdown['Style Match'] >= 75
    ? `Draws on styles you've told us you like${userStyles.length ? ` (${userStyles.slice(0, 2).join(', ')})` : ''}, scoring ${breakdown['Style Match']}/100 on style match.`
    : `Sits a little outside your usual style preferences (${breakdown['Style Match']}/100 style match) — a chance to mix things up rather than a mismatch.`;

  const colorReason = `These pieces form ${harmonyLabel(breakdown['Color Harmony'])} color pairing (${breakdown['Color Harmony']}/100 harmony), and ${breakdown['Color Preference'] >= 70 ? 'lean into colors you already like' : 'bring in some different color choices'} (${breakdown['Color Preference']}/100 preference match).`;

  const occasionReason = `Scored ${breakdown['Occasion Fit']}/100 for ${occasion} — ${breakdown['Occasion Fit'] >= 80 ? 'a strong fit for the formality and setting this calls for' : 'a reasonable fit, though not an exact formality match'}.`;

  const weatherReason = (context.weather && context.weather.temp !== null && context.weather.temp !== undefined)
    ? `At ${context.weather.temp}°C in Kathmandu (${context.weather.condition || 'current conditions'}), this scores ${breakdown['Weather Fit']}/100 for weather suitability.`
    : `Live weather wasn't available, so this leaned on Kathmandu's seasonal averages (${breakdown['Weather Fit']}/100 weather fit).`;

  const behaviorReason = context.insights?.hasHistory
    ? `Weighed against your past choices${context.insights.topColors?.length ? ` (like ${context.insights.topColors.slice(0, 2).join(', ')})` : ''}, this scores ${breakdown['Behavior Match']}/100 on matching your established preferences.`
    : `You don't have much interaction history yet, so this leaned on your style profile rather than learned behavior (${breakdown['Behavior Match']}/100).`;

  const ownedCount = outfitItems.length;
  const gapCount = candidate.needsSuggestion?.length || 0;
  const wardrobeReason = gapCount > 0
    ? `${ownedCount} piece${ownedCount !== 1 ? 's' : ''} came from your own wardrobe; ${gapCount} slot${gapCount !== 1 ? 's were' : ' was'} filled with a suggestion since nothing already owned fit well.`
    : `All ${ownedCount} pieces came straight from your own wardrobe — no external suggestions needed.`;

  const calendarReason = context.upcomingEvent
    ? `You have ${context.upcomingEvent.occasion || context.upcomingEvent.eventType || 'an event'} coming up in about ${context.upcomingEvent.hoursAway}h, which shaped this pick.`
    : '';

  return { summary, styleReason, colorReason, occasionReason, weatherReason, behaviorReason, wardrobeReason, calendarReason };
}

// ── Optional LLM polish (0 or 1 call for the WHOLE session) ─────────────────

const POLISH_SYSTEM_PROMPT = `You are a warm, encouraging fashion stylist writing for an 18-25 year old woman in Kathmandu. You will be given several outfit explanations as JSON, each already containing every fact (scores, item counts, weather, occasion) that must appear. Rewrite ONLY the prose style — warmer and more natural. Do NOT change, add, invent, or remove any number, item name, occasion, temperature, or claim. Do NOT change which fields exist.

STRICT LENGTH RULE: each rewritten field must be ONE sentence, roughly the same length as the input field — not longer. Do not pad with filler phrases like "which is why I've included" or repeat the same idea twice. Brevity is required because the output must fit a fixed size budget for all outfits combined.

Respond with ONLY a JSON object, no markdown fences, no commentary: {"explanations": [{"index": 0, "summary": "...", "styleReason": "...", "colorReason": "...", "occasionReason": "...", "weatherReason": "...", "behaviorReason": "...", "wardrobeReason": "...", "calendarReason": "..."}, ...]}. Keep calendarReason as an empty string "" if the input had one.`;

function parseJsonRepair(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); }
  catch {
    try { return JSON.parse(match[0].replace(/,\s*([}\]])/g, '$1')); }
    catch { return null; }
  }
}

function isValidExplanationShape(obj) {
  if (!obj || typeof obj !== 'object') return false;
  return EXPLANATION_FIELDS.every(f => typeof obj[f] === 'string');
}

/**
 * @param {Array} selected - diversityEngine.selectDiverse output, each { catMeta, scored, rank }
 * @param {object} user
 * @param {object} context
 * @returns {Promise<Array>} selected entries with .templateExplanation attached
 */
exports.explainSession = async function explainSession(selected, user, context) {
  const withTemplates = selected.map(sel => ({
    ...sel,
    templateExplanation: buildTemplateExplanation(sel.scored, sel.catMeta.key, user, context),
  }));

  const provider = aiProvider.getActiveProvider();
  if (!provider) {
    return withTemplates.map(e => ({ ...e, explanation: e.templateExplanation, explanationSource: 'template' }));
  }

  try {
    const payload = withTemplates.map((e, i) => ({
      index: i,
      category: e.catMeta.label,
      confidence: e.scored.confidence,
      ...e.templateExplanation,
    }));

    const raw = await aiProvider.generateText({
      systemPrompt: POLISH_SYSTEM_PROMPT,
      userPrompt: `Rewrite the prose in these ${payload.length} outfit explanations, preserving every fact exactly and keeping each field to one concise sentence:\n${JSON.stringify(payload)}`,
      maxTokens: 500 + payload.length * 500, // scales with session size — 5 outfits/8 fields needs real headroom
    });

    const parsed = parseJsonRepair(raw);
    if (!parsed || !Array.isArray(parsed.explanations)) throw new Error('Unexpected LLM response shape');

    return withTemplates.map((e, i) => {
      const polished = parsed.explanations.find(p => p.index === i) || parsed.explanations[i];
      if (!isValidExplanationShape(polished)) {
        return { ...e, explanation: e.templateExplanation, explanationSource: 'template' };
      }
      const { index, category, confidence, ...cleanFields } = polished;
      return { ...e, explanation: cleanFields, explanationSource: 'llm_polished' };
    });
  } catch (err) {
    console.warn('[explanationService] LLM polish failed, keeping template explanations:', err.message);
    return withTemplates.map(e => ({ ...e, explanation: e.templateExplanation, explanationSource: 'template' }));
  }
};

exports.buildTemplateExplanation = buildTemplateExplanation;
