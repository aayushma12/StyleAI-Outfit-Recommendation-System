'use strict';

// ── Category scoring weights — single source of truth ──────────────────────
// Extracted from scoringService.js so the tunable numbers live in one place
// (backend/config/, alongside the project's other environment/service config)
// rather than buried inside the scoring logic itself. This is what "weights
// should be configurable" means at this project's scale: one file, clearly
// commented, not 100+ individually env-var-driven values — that would make
// the weights harder to reason about, not easier.
//
// The 5 non-wizard categories (best_match, most_stylish, most_comfortable,
// weather_optimized, wardrobe_champion) are UNCHANGED from before this file
// existed — same 9 dimensions, same values, same behavior. Only the 3 wizard
// categories gained 5 new dimensions (dresscodeFit, indoorOutdoorFit,
// dayNightFit, vibeMatch, budgetFit) to actually use the wizard's budget/
// dresscode/indoorOutdoor/dayNight/vibe answers, which previously reached
// storage but never scoring. Every category's weights still sum to 1.0.
const CATEGORY_WEIGHTS = {
  best_match: {
    styleMatch:    0.18, colorHarmony:  0.12, colorPref:     0.12,
    occasionFit:   0.16, weatherFit:    0.12, behaviorSignal:0.09,
    bodyTypeMatch: 0.08, fabricMatch:   0.07, trendScore:    0.06,
  },
  most_stylish: {
    styleMatch:    0.22, colorHarmony:  0.22, colorPref:     0.19,
    occasionFit:   0.08, weatherFit:    0.00, behaviorSignal:0.05,
    bodyTypeMatch: 0.07, fabricMatch:   0.06, trendScore:    0.11,
  },
  most_comfortable: {
    styleMatch:    0.07, colorHarmony:  0.04, colorPref:     0.11,
    occasionFit:   0.07, weatherFit:    0.30, behaviorSignal:0.20,
    bodyTypeMatch: 0.09, fabricMatch:   0.10, trendScore:    0.02,
  },
  weather_optimized: {
    styleMatch:    0.07, colorHarmony:  0.03, colorPref:     0.07,
    occasionFit:   0.16, weatherFit:    0.44, behaviorSignal:0.05,
    bodyTypeMatch: 0.04, fabricMatch:   0.09, trendScore:    0.05,
  },
  wardrobe_champion: {
    styleMatch:    0.18, colorHarmony:  0.15, colorPref:     0.15,
    occasionFit:   0.16, weatherFit:    0.08, behaviorSignal:0.05,
    bodyTypeMatch: 0.09, fabricMatch:   0.08, trendScore:    0.06,
  },

  // ── Wizard categories — now scored on all 14 dimensions ──────────────────
  // The 5 new dimensions' relative share (of whatever total each category
  // allocates to them) follows the same ratio everywhere: vibeMatch is
  // weighted highest since the wizard requires a vibe selection (the other
  // 4 all have defaults and are frequently left unchanged), dresscodeFit
  // next (an explicit, if optional, free-text signal), indoorOutdoor/
  // dayNight next (contextual but coarse), budgetFit lowest (an owned-vs-
  // suggested proxy, not a real price signal — see docs).
  wizard_option_1: {
    styleMatch:    0.15, colorHarmony:  0.10, colorPref:     0.10,
    occasionFit:   0.13, weatherFit:    0.07, behaviorSignal:0.06,
    bodyTypeMatch: 0.06, fabricMatch:   0.05, trendScore:    0.02,
    vibeMatch:     0.09, dresscodeFit:  0.07, indoorOutdoorFit: 0.04,
    dayNightFit:   0.04, budgetFit:     0.02,
  },
  wizard_option_2: {
    styleMatch:    0.17, colorHarmony:  0.15, colorPref:     0.11,
    occasionFit:   0.11, weatherFit:    0.05, behaviorSignal:0.05,
    bodyTypeMatch: 0.05, fabricMatch:   0.05, trendScore:    0.05,
    vibeMatch:     0.08, dresscodeFit:  0.06, indoorOutdoorFit: 0.03,
    dayNightFit:   0.03, budgetFit:     0.01,
  },
  wizard_option_3: {
    styleMatch:    0.16, colorHarmony:  0.10, colorPref:     0.10,
    occasionFit:   0.12, weatherFit:    0.06, behaviorSignal:0.07,
    bodyTypeMatch: 0.06, fabricMatch:   0.05, trendScore:    0.02,
    vibeMatch:     0.09, dresscodeFit:  0.07, indoorOutdoorFit: 0.04,
    dayNightFit:   0.04, budgetFit:     0.02,
  },
};

module.exports = { CATEGORY_WEIGHTS };
