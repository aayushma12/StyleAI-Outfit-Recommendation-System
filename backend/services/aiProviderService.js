'use strict';

// ── Shared LLM provider service ─────────────────────────────────────────────
// Single source of truth for calling Anthropic/Gemini/Groq — text and vision.
// Replaces the duplicated cascades that used to live separately in
// recommendationEngine.js and aiController.js.

const Groq                    = require('groq-sdk');
const Anthropic               = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI }  = require('@google/generative-ai');

// Without this, a hung provider (network stall, provider-side outage) can
// hold a chat/recommendation/vision request open indefinitely — Anthropic's
// SDK default is 10 minutes, Groq's is 1 minute, and Gemini's has no client
// default at all. All three calls have a real, generous-but-bounded ceiling.
const REQUEST_TIMEOUT_MS = 20000;

// ── Provider identity ────────────────────────────────────────────────────────

exports.getActiveProvider = function getActiveProvider() {
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.GEMINI_API_KEY)    return 'gemini';
  if (process.env.GROQ_API_KEY)      return 'groq';
  return null;
};

exports.getActiveProviderLabel = function getActiveProviderLabel() {
  const p = exports.getActiveProvider();
  return p === 'anthropic' ? 'Anthropic Claude'
       : p === 'gemini'    ? 'Google Gemini'
       : p === 'groq'      ? 'Groq'
       : null;
};

// ── Text generation — Anthropic → Gemini → Groq, 3-attempt retry ───────────

async function callTextOnce(systemPrompt, userPrompt, maxTokens) {
  if (process.env.ANTHROPIC_API_KEY) {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: REQUEST_TIMEOUT_MS });
    const res = await client.messages.create({
      model:      process.env.AI_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    });
    return res.content[0]?.text || '';
  }
  if (process.env.GEMINI_API_KEY) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      systemInstruction: systemPrompt,
      // thinkingBudget: 0 — these are single-shot extraction/prose tasks with a
      // fixed output shape, not multi-step reasoning problems. Without this,
      // "thinking"-capable Gemini models can consume the entire maxOutputTokens
      // budget on invisible reasoning and return truncated (unparseable) JSON.
      generationConfig: { maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } },
    }, { timeout: REQUEST_TIMEOUT_MS });
    const result = await model.generateContent(userPrompt);
    return result.response.text();
  }
  if (process.env.GROQ_API_KEY) {
    const client = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: REQUEST_TIMEOUT_MS });
    const res = await client.chat.completions.create({
      model:      process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
    });
    return res.choices[0]?.message?.content || '';
  }
  throw new Error('No AI provider configured. Add GEMINI_API_KEY, GROQ_API_KEY, or ANTHROPIC_API_KEY.');
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

// ── Multi-turn chat — same cascade, but preserves conversation history ─────
// generateText() is single-shot (one user prompt, no history) and is what the
// recommendation pipeline's gap-fill/prose-polish calls use. The AI Assistant
// needs actual multi-turn context, so this is a separate entry point rather
// than overloading generateText's signature.

async function callChatOnce(systemPrompt, history, userMessage, maxTokens) {
  if (process.env.ANTHROPIC_API_KEY) {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: REQUEST_TIMEOUT_MS });
    const res = await client.messages.create({
      model:      process.env.AI_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system:     systemPrompt,
      messages:   [...history, { role: 'user', content: userMessage }],
    });
    return res.content[0]?.text || '';
  }
  if (process.env.GEMINI_API_KEY) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      systemInstruction: systemPrompt,
      // thinkingBudget: 0 — these are single-shot extraction/prose tasks with a
      // fixed output shape, not multi-step reasoning problems. Without this,
      // "thinking"-capable Gemini models can consume the entire maxOutputTokens
      // budget on invisible reasoning and return truncated (unparseable) JSON.
      generationConfig: { maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } },
    }, { timeout: REQUEST_TIMEOUT_MS });
    const geminiHistory = history.map(m => ({
      role:  m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const chat   = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(userMessage);
    return result.response.text();
  }
  if (process.env.GROQ_API_KEY) {
    const client = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: REQUEST_TIMEOUT_MS });
    const res = await client.chat.completions.create({
      model:      process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: userMessage },
      ],
    });
    return res.choices[0]?.message?.content || '';
  }
  throw new Error('No AI provider configured. Add GEMINI_API_KEY, GROQ_API_KEY, or ANTHROPIC_API_KEY.');
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

// ── Vision — Gemini → Anthropic → Groq(only if GROQ_VISION_MODEL set) ──────
// Order differs from text generation: Gemini's free-tier vision quality/
// reliability is currently the best bet given this project's provider mix.
// Never throws — callers always get { available: false } instead, so a
// wardrobe upload never hard-fails just because vision is unreachable.

async function visionViaGemini({ systemPrompt, imagePrompt, imageBuffer, mimeType, maxTokens }) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    systemInstruction: systemPrompt,
    // thinkingBudget: 0 — see the note in callTextOnce; applies equally to
    // vision extraction (also a fixed-shape, single-shot JSON task).
    generationConfig: { maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } },
  }, { timeout: REQUEST_TIMEOUT_MS });
  const result = await model.generateContent([
    { inlineData: { data: imageBuffer.toString('base64'), mimeType } },
    { text: imagePrompt },
  ]);
  return result.response.text();
}

async function visionViaAnthropic({ systemPrompt, imagePrompt, imageBuffer, mimeType, maxTokens }) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: REQUEST_TIMEOUT_MS });
  const res = await client.messages.create({
    model:      process.env.AI_VISION_MODEL || process.env.AI_MODEL || 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    system:     systemPrompt,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBuffer.toString('base64') } },
        { type: 'text', text: imagePrompt },
      ],
    }],
  });
  return res.content[0]?.text || '';
}

async function visionViaGroq({ systemPrompt, imagePrompt, imageBuffer, mimeType, maxTokens }) {
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: REQUEST_TIMEOUT_MS });
  const res = await client.chat.completions.create({
    model:      process.env.GROQ_VISION_MODEL,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: imagePrompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBuffer.toString('base64')}` } },
        ],
      },
    ],
  });
  return res.choices[0]?.message?.content || '';
}

exports.generateVision = async function generateVision({ systemPrompt, imagePrompt, imageBuffer, mimeType, maxTokens = 800 }) {
  const attempts = [];
  if (process.env.GEMINI_API_KEY)                          attempts.push(['gemini',    visionViaGemini]);
  if (process.env.ANTHROPIC_API_KEY)                       attempts.push(['anthropic', visionViaAnthropic]);
  if (process.env.GROQ_API_KEY && process.env.GROQ_VISION_MODEL) attempts.push(['groq', visionViaGroq]);

  for (const [provider, fn] of attempts) {
    try {
      const text = await fn({ systemPrompt, imagePrompt, imageBuffer, mimeType, maxTokens });
      return { available: true, provider, text };
    } catch (err) {
      console.warn(`[aiProviderService] vision via ${provider} failed:`, err.message);
    }
  }
  return { available: false, provider: '', text: '' };
};
