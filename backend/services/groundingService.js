'use strict';

// ── AI Assistant grounding check ────────────────────────────────────────────
// The chat assistant's outfit-intent replies are already grounded (built
// from the deterministic recommendation pipeline's real output — see
// aiController.js's OUTFIT_INTENT_RE routing). Its FREEHAND replies
// (styling advice, follow-up questions) rely only on a system-prompt
// instruction to "reference only wardrobe items that genuinely exist" —
// unenforced in code. This module adds a real, testable (if deliberately
// conservative) check: does the reply reference a specific owned item by
// name in a way that doesn't match anything in the user's actual wardrobe?
//
// KNOWN LIMITATIONS (documented honestly, not hidden):
//  - This is a LEXICAL heuristic (token overlap), not semantic verification.
//    A paraphrased or synonym-based hallucination ("that emerald top" when
//    the wardrobe only has a "green blouse") can slip through.
//  - It may occasionally over-flag a real item described in unusual words.
//  - It only checks for "your/the ___" reference phrasing — it does not
//    catch every possible way a model could invent an item.
// It is a bounded safety net, not a hallucination-detection guarantee.

const REFERENCE_RE = /\b(?:your|the)\s+([a-z][a-z\s]{1,40}?)\s+(?:you (?:have|own)|in your wardrobe|is|are|would|could|works|matches|pairs)\b/gi;
const DISCLAIMER_RE = /not in your wardrobe|suggested|don'?t (?:currently )?own|don'?t have|you (?:could|might) (?:buy|get|add)/i;
const MIN_OVERLAP = 0.34;
const CONTEXT_WINDOW = 40;

function tokenize(str) {
  return (str || '').toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * @param {string} replyText - the assistant's freehand reply text.
 * @param {Array}  wardrobeItems - the user's real wardrobe items ({name, color, category}).
 * @returns {{ ok: boolean, flaggedPhrases: string[] }}
 */
exports.checkGrounding = function checkGrounding(replyText, wardrobeItems = []) {
  const knownTokens = new Set(
    (wardrobeItems || [])
      .flatMap(it => [it?.name, it?.color, it?.category].filter(Boolean))
      .flatMap(s => tokenize(s))
  );

  const flagged = [];
  if (typeof replyText === 'string' && replyText.length) {
    let match;
    REFERENCE_RE.lastIndex = 0;
    while ((match = REFERENCE_RE.exec(replyText)) !== null) {
      const phrase = match[1].trim();
      const tokens = tokenize(phrase);
      if (!tokens.length) continue;

      const overlap = knownTokens.size
        ? tokens.filter(t => knownTokens.has(t)).length / tokens.length
        : 0;

      const start = Math.max(0, match.index - CONTEXT_WINDOW);
      const nearbyText = replyText.slice(start, match.index + phrase.length + CONTEXT_WINDOW);

      if (overlap < MIN_OVERLAP && !DISCLAIMER_RE.test(nearbyText)) {
        flagged.push(phrase);
      }
    }
  }

  const uniqueFlagged = [...new Set(flagged)].slice(0, 5);
  return { ok: uniqueFlagged.length === 0, flaggedPhrases: uniqueFlagged };
};
