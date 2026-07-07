'use strict';

// ── Gemini AI provider service ──────────────────────────────────────────────
// Single source of truth for calling Google Gemini — text, chat, and vision.
// StyleAI uses Gemini exclusively; this module is the only place the SDK is
// imported so every AI-powered feature (chat, recommendation-explanation
// polish, wardrobe vision tagging) goes through one shared client/config.

const { GoogleGenAI } = require('@google/genai');

// Without this, a hung request (network stall, provider-side outage) can hold
// a chat/recommendation/vision request open indefinitely.
const REQUEST_TIMEOUT_MS = 20000;

function getClient() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: REQUEST_TIMEOUT_MS } });
}

// ── Provider identity ────────────────────────────────────────────────────────

exports.getActiveProvider = function getActiveProvider() {
  return process.env.GEMINI_API_KEY ? 'gemini' : null;
};

exports.getActiveProviderLabel = function getActiveProviderLabel() {
  return exports.getActiveProvider() === 'gemini' ? 'Google Gemini' : null;
};

// ── Text generation — 3-attempt retry ───────────────────────────────────────

async function callTextOnce(systemPrompt, userPrompt, maxTokens) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('No AI provider configured. Add GEMINI_API_KEY.');
  }
  const response = await getClient().models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: maxTokens,
      // thinkingBudget: 0 — these are single-shot extraction/prose tasks with a
      // fixed output shape, not multi-step reasoning problems. Without this,
      // "thinking"-capable Gemini models can consume the entire maxOutputTokens
      // budget on invisible reasoning and return truncated (unparseable) JSON.
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  return response.text || '';
}

exports.generateText = async function generateText({ systemPrompt, userPrompt, maxTokens = 4000 }) {
  const MAX_ATTEMPTS = 3;
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await callTextOnce(systemPrompt, userPrompt, maxTokens);
    } catch (err) {
      lastErr = err;
      if (err.status === 401 || err.status === 403 || err.status === 429) throw err;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
        console.warn(`[aiProviderService] text call attempt ${attempt} failed, retrying...`);
      }
    }
  }
  throw lastErr;
};

// ── Multi-turn chat — preserves conversation history ────────────────────────
// generateText() is single-shot (one user prompt, no history) and is what the
// recommendation pipeline's gap-fill/prose-polish calls use. The AI Assistant
// needs actual multi-turn context, so this is a separate entry point rather
// than overloading generateText's signature.

async function callChatOnce(systemPrompt, history, userMessage, maxTokens) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('No AI provider configured. Add GEMINI_API_KEY.');
  }
  const geminiHistory = history.map(m => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const chat = getClient().chats.create({
    model:   process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    history: geminiHistory,
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: maxTokens,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  const result = await chat.sendMessage({ message: userMessage });
  return result.text || '';
}

exports.generateChatReply = async function generateChatReply({ systemPrompt, history = [], userMessage, maxTokens = 1500 }) {
  const MAX_ATTEMPTS = 3;
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await callChatOnce(systemPrompt, history, userMessage, maxTokens);
    } catch (err) {
      lastErr = err;
      if (err.status === 401 || err.status === 403 || err.status === 429) throw err;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
        console.warn(`[aiProviderService] chat call attempt ${attempt} failed, retrying...`);
      }
    }
  }
  throw lastErr;
};

// ── Vision — never throws; callers always get { available: false } instead,
// so a wardrobe upload never hard-fails just because vision is unreachable.

async function visionViaGemini({ systemPrompt, imagePrompt, imageBuffer, mimeType, maxTokens }) {
  const response = await getClient().models.generateContent({
    model: process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    contents: [
      { inlineData: { data: imageBuffer.toString('base64'), mimeType } },
      { text: imagePrompt },
    ],
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: maxTokens,
      // thinkingBudget: 0 — see the note in callTextOnce; applies equally to
      // vision extraction (also a fixed-shape, single-shot JSON task).
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  return response.text || '';
}

exports.generateVision = async function generateVision({ systemPrompt, imagePrompt, imageBuffer, mimeType, maxTokens = 800 }) {
  if (!process.env.GEMINI_API_KEY) {
    return { available: false, provider: '', text: '' };
  }
  try {
    const text = await visionViaGemini({ systemPrompt, imagePrompt, imageBuffer, mimeType, maxTokens });
    return { available: true, provider: 'gemini', text };
  } catch (err) {
    console.warn('[aiProviderService] vision via gemini failed:', err.message);
    return { available: false, provider: '', text: '' };
  }
};
