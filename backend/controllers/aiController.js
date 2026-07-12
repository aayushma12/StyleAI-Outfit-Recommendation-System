const AIConversation  = require('../models/AIConversation');
const WardrobeItem    = require('../models/WardrobeItem');
const WardrobeCombo   = require('../models/WardrobeCombo');
const OutfitCalendar  = require('../models/OutfitCalendar');
const User            = require('../models/User');
const { getUserInsights } = require('../services/behaviorService');
const logActivity     = require('../utils/historyLogger');
const { logBehavior }  = require('../services/behaviorService');
const aiProvider       = require('../services/aiProviderService');
const weatherService   = require('../services/weatherService');
const kathmandu        = require('../services/kathmanduIntelligence');
const recommendationEngine = require('../services/recommendationEngine');
const groundingService = require('../services/groundingService');
const { escapeRegex }  = require('../utils/validation');

// ── Outfit-request intent detection ──────────────────────────────────────────
// When the user is clearly asking "what should I wear", route through the
// SAME deterministic recommendation pipeline the dashboard uses instead of
// letting the assistant free-associate an outfit from scratch — previously
// chat and the recommendation panel were two disconnected "brains" that could
// suggest contradictory outfits from the same wardrobe.

const OUTFIT_INTENT_RE = /\b(what (should|can|do|to) i wear|what to wear|suggest .*(an outfit|something to wear)|recommend .*(an outfit|clothes|what to wear)|outfit for|style me|dress me|help me (dress|get dressed)|pick (an outfit|something)|put together (an outfit|a look))\b/i;

const OCCASION_KEYWORDS = {
  office: ['office', 'work meeting', ' work ', 'workplace', 'interview', 'business meeting', 'formal event', 'presentation'],
  traditional: ['wedding', 'marriage ceremony', 'festival', 'dashain', 'tihar', 'teej', 'holi', 'graduation'],
  sports: ['gym', 'workout', 'exercise', 'trekking', 'hike'],
  party: ['party', 'celebration', 'birthday', 'date night', 'a date'],
  daily: ['college', 'university', 'class', 'cafe', 'coffee', 'brunch', 'travel', 'trip', 'family gathering', 'family function'],
};

function detectOutfitOccasion(message) {
  if (!OUTFIT_INTENT_RE.test(message)) return null;
  const lower = ` ${message.toLowerCase()} `;
  for (const [occasion, keywords] of Object.entries(OCCASION_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return occasion;
  }
  return 'daily';
}

function cap(s) {
  return (s || '').replace(/\b\w/g, c => c.toUpperCase());
}

function replyFromRecommendationSession(session, occasion) {
  const top = session.recommendations?.[0];
  if (!top) return null;

  const slotLines = Object.entries(top.outfit || {})
    .filter(([, s]) => s && (s.name || s.suggestion))
    .map(([slot, s]) => `**${cap(slot.replace(/_/g, ' '))}**: ${s.name || s.suggestion}${s.item ? '' : ' (suggested — not in your wardrobe)'}`)
    .join('\n');

  const reply = [
    `Here's what I'd suggest for **${cap(occasion.replace(/_/g, ' '))}** (${top.confidence}% match):`,
    '',
    slotLines,
    '',
    `**Why this works**: ${top.explanation?.summary || 'This balances your style profile, the occasion, and today\'s Kathmandu weather.'}`,
    '',
    `I generated ${session.recommendations.length} total options — open your Recommendations panel to see all of them, rate this one, or ask me to adjust it.`,
  ].join('\n');

  return reply;
}

async function buildContext(userId) {
  const [items, combos, upcoming] = await Promise.all([
    WardrobeItem.find({ user: userId }).sort({ createdAt: -1 }).limit(60).lean(),
    WardrobeCombo.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean(),
    OutfitCalendar.find({ user: userId, date: { $gte: new Date() } })
      .sort({ date: 1 }).limit(5).populate('combo', 'name').lean(),
  ]);

  const groups = {};
  items.forEach(it => {
    const cat = it.category || 'other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(`• ${it.name} [${[it.color, it.occasion, it.season].filter(Boolean).join(', ')}]`);
  });

  const wardrobeSections = Object.entries(groups)
    .map(([cat, lines]) => `**${cap(cat)} (${lines.length})**\n${lines.join('\n')}`)
    .join('\n\n');

  const outfitList = combos
    .map(c => `• ${c.name || 'Unnamed Outfit'}${c.matchScore ? ` (Score: ${c.matchScore}%)` : ''}${c.occasion ? ` — ${c.occasion}` : ''}`)
    .join('\n') || 'No saved outfits yet.';

  const calendarList = upcoming.length
    ? upcoming.map(e => {
        const d = new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `• ${d}: "${e.outfitName || (e.combo?.name) || 'Scheduled outfit'}"${e.occasion ? ` (${e.occasion})` : ''}`;
      }).join('\n')
    : 'No upcoming scheduled outfits.';

  return { wardrobeSections, outfitList, calendarList, totalItems: items.length, totalCombos: combos.length, rawItems: items };
}

function buildSystemPrompt(user, ctx, weather, insights = {}, seasonLabel) {
  const firstName = user.name?.split(' ')[0] || 'there';
  const now  = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const weatherStr = weather.temp !== null
    ? `${weather.temp}°C (feels like ${weather.feelsLike}°C) · ${weather.condition} · Humidity: ${weather.humidity}% · Wind: ${weather.windSpeed} km/h`
    : 'Weather data currently unavailable';

  const profile = [
    user.gender              && `Gender: ${cap(user.gender.replace(/_/g, ' '))}`,
    user.age                 && `Age: ${user.age}`,
    user.occupation          && `Occupation: ${user.occupation}`,
    user.bodyType            && `Body type: ${cap(user.bodyType.replace(/_/g, ' '))}`,
    user.skinTone            && `Skin tone: ${user.skinTone}`,
    user.clothingFit         && `Preferred fit: ${user.clothingFit}`,
    user.modestyLevel        && `Modesty level: ${user.modestyLevel}`,
    user.lifestyle           && `Lifestyle: ${user.lifestyle.replace(/_/g, ' ')}`,
    user.fashionConfidence   && `Fashion confidence: ${user.fashionConfidence}/5`,
    (user.stylePreferences?.length || user.fashionStyles?.length) &&
      `Style preferences: ${[...(user.stylePreferences || []), ...(user.fashionStyles || [])].join(', ')}`,
    user.colorPreferences?.length    && `Favourite colors: ${user.colorPreferences.join(', ')}`,
    user.dislikedColors?.length      && `Disliked colors: ${user.dislikedColors.join(', ')}`,
    user.occasionPreferences?.length && `Frequent occasions: ${user.occasionPreferences.join(', ')}`,
    user.accessoryStyle              && `Accessory style: ${user.accessoryStyle}`,
    user.footwearPreferences?.length && `Footwear preference: ${user.footwearPreferences.join(', ')}`,
    user.additionalStyleNotes        && `Style notes: ${user.additionalStyleNotes}`,
  ].filter(Boolean).join('\n') || 'Profile not yet configured.';

  const learnedInsights = insights.hasHistory ? [
    insights.topColors?.length      && `  Observed favourite colors: ${insights.topColors.slice(0, 5).join(', ')}`,
    insights.topCategories?.length  && `  Most worn categories: ${insights.topCategories.slice(0, 4).join(', ')}`,
    insights.topOccasions?.length   && `  Common occasions: ${insights.topOccasions.slice(0, 3).join(', ')}`,
    insights.recommendationStats?.acceptRate !== null
      && `  Recommendation acceptance rate: ${insights.recommendationStats.acceptRate}% (${insights.recommendationStats.accepted} accepted, ${insights.recommendationStats.rejected} rejected)`,
  ].filter(Boolean).join('\n') : '  Learning from interactions... (limited history so far)';

  return `You are StyleAI's AI Fashion Advisor — a professional, knowledgeable, and highly personalised styling consultant for ${user.name}.

## Role
You are ${firstName}'s dedicated fashion advisor. Your responsibilities are:
- Curating complete outfit combinations from their wardrobe
- Planning outfits for specific occasions, events, and weather conditions
- Providing colour coordination and styling guidance
- Identifying wardrobe gaps and recommending complementary pieces
- Delivering fashion advice grounded in Kathmandu's culture, climate, and lifestyle
- Answering any fashion-related question with precision and expertise

Note: direct "what should I wear" requests are answered by StyleAI's deterministic recommendation engine before you ever see them, so you don't need to invent full outfits from scratch — focus on follow-up questions, adjustments, and general styling advice.

## Current Context
Date: ${dateStr}, ${timeStr} (Nepal Standard Time)
Kathmandu Weather: ${weatherStr}
Season: ${seasonLabel}

## ${firstName}'s Style Profile
${profile}

## Observed Preferences (derived from ${firstName}'s activity)
${learnedInsights}

## Wardrobe — ${ctx.totalItems} items
${ctx.wardrobeSections || 'The wardrobe is currently empty. Recommend that the user adds items via the Wardrobe section.'}

## Saved Outfits — ${ctx.totalCombos}
${ctx.outfitList}

## Upcoming Calendar
${ctx.calendarList}

## Behavioural Guidelines

1. **Wardrobe-first**: Prioritise items from ${firstName}'s actual wardrobe. If suggesting items not currently owned, label them explicitly as "Suggested (not in your wardrobe)".

2. **Justify every recommendation**: Do not merely list items. Explain the rationale — how colours complement each other, why the combination suits the occasion, and how it accounts for current Kathmandu weather conditions.

3. **Maintain a professional tone**: Respond with confidence and clarity. Avoid overly casual expressions, excessive enthusiasm, or informal language. Be helpful and precise — the way a knowledgeable styling consultant would communicate.

4. **Minimise emoji usage**: Do not use decorative emojis in responses. Plain, well-structured text is preferred.

5. **Complete outfits**: Every outfit recommendation must include at minimum a top and bottom (or a dress), footwear, and weather-appropriate layering where needed.

6. **Scope**: If asked about topics outside of fashion and personal styling, acknowledge politely and redirect. Example: "That falls outside my area of expertise, but I can certainly help you plan the right outfit for your upcoming plans. What is the occasion?"

7. **Accuracy**: Reference only wardrobe items that genuinely exist in ${firstName}'s collection. Do not invent items or suggest the user owns something they have not added.

8. **Weather-aware**: Always account for current Kathmandu conditions. Rain: recommend appropriate footwear and waterproof layering. Cold (below 15°C): suggest warm, layered options. Hot and humid (monsoon): recommend lightweight, breathable fabrics.

9. **Concise and structured**: Keep responses focused and readable. Use bold headings and short bullet points where appropriate.

10. **Contextual memory**: Use information ${firstName} has already provided in this conversation. Do not ask for details that have already been shared.

11. **Kathmandu context**: Apply knowledge of Nepal's climate, cultural calendar, and lifestyle — Dashain, Tihar, Teej, Holi, Bisket Jatra, college culture, corporate dress norms, hill station travel, Thamel and Durbar Marg settings.

## Follow-Up Suggestions (Mandatory — Every Response)
At the very end of EVERY response, on its own final line, append exactly:
SUGGESTIONS:["<suggestion 1>","<suggestion 2>","<suggestion 3>"]
Rules:
- All 3 suggestions must be directly relevant to the topic just discussed
- Write them as concise questions the user might ask next (under 55 characters each)
- Do NOT include "SUGGESTIONS:" anywhere else in the response body
- Always include this line — even for greetings, simple factual answers, or redirections`;
}

exports.searchConversations = async (req, res) => {
  const { q = '' } = req.query;
  if (!q.trim()) return res.json({ conversations: [] });
  const safe = escapeRegex(q.trim());

  const convs = await AIConversation.find({
    user: req.user._id,
    $or: [
      { title: { $regex: safe, $options: 'i' } },
      { 'messages.content': { $regex: safe, $options: 'i' } },
    ],
  })
    .sort({ lastActivity: -1 })
    .limit(15)
    .select('title lastActivity messages');

  res.json({
    conversations: convs.map(c => ({
      _id:          c._id,
      title:        c.title,
      lastActivity: c.lastActivity,
      messageCount: c.messages.length,
      preview:      c.messages.length > 0
        ? c.messages[c.messages.length - 1].content.replace(/\nSUGGESTIONS:\[.*?\]/s, '').slice(0, 80)
        : '',
    })),
  });
};

exports.exportConversation = async (req, res) => {
  const conv = await AIConversation.findOne({ _id: req.params.id, user: req.user._id });
  if (!conv) return res.status(404).json({ message: 'Conversation not found.' });

  const header = [
    'StyleAI Fashion Assistant — Conversation Export',
    `Title: ${conv.title}`,
    `Exported: ${new Date().toLocaleString('en-US')}`,
    `Messages: ${conv.messages.length}`,
    '─'.repeat(55),
    '',
  ].join('\n');

  const body = conv.messages.map(m => {
    const role    = m.role === 'user' ? 'You' : 'StyleAI Fashion Assistant';
    const ts      = m.createdAt
      ? new Date(m.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';
    const content = m.content.replace(/\nSUGGESTIONS:\[.*?\]/s, '').trim();
    return `${role}${ts ? ` (${ts})` : ''}:\n${content}\n`;
  }).join('\n');

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="styleai-${conv._id.toString().slice(-8)}.txt"`);
  res.send(header + body);
};

exports.getConversations = async (req, res) => {
  const convs = await AIConversation.find({ user: req.user._id })
    .sort({ lastActivity: -1 })
    .limit(30)
    .select('title lastActivity createdAt messages');

  const list = convs.map(c => ({
    _id:          c._id,
    title:        c.title,
    lastActivity: c.lastActivity,
    messageCount: c.messages.length,
    preview:      c.messages.length > 0
      ? c.messages[c.messages.length - 1].content.slice(0, 80)
      : '',
  }));

  res.json({ conversations: list });
};

exports.getConversation = async (req, res) => {
  const conv = await AIConversation.findOne({ _id: req.params.id, user: req.user._id });
  if (!conv) return res.status(404).json({ message: 'Conversation not found.' });
  res.json({ conversation: conv });
};

exports.getProvider = async (req, res) => {
  const provider = aiProvider.getActiveProvider();
  res.json({
    configured: !!provider,
    provider,
    name: aiProvider.getActiveProviderLabel(),
  });
};

exports.sendMessage = async (req, res) => {
  const { message, conversationId } = req.body;
  if (!message?.trim()) return res.status(400).json({ message: 'Message is required.' });
  if (message.trim().length > 2000) return res.status(400).json({ message: 'Message too long. Please keep messages under 2000 characters.' });

  const provider = aiProvider.getActiveProvider();
  if (!provider) {
    return res.status(503).json({
      message: 'AI Assistant needs an API key. Add GEMINI_API_KEY to backend/.env — get a free key at aistudio.google.com/app/apikey.',
    });
  }

  const userId  = req.user._id;
  const userMsg = message.trim();

  // Resolve conversation
  let conv;
  if (conversationId) {
    conv = await AIConversation.findOne({ _id: conversationId, user: userId });
    if (!conv) return res.status(404).json({ message: 'Conversation not found.' });
  } else {
    const title = userMsg.length > 60 ? userMsg.slice(0, 57) + '…' : userMsg;
    conv = await AIConversation.create({ user: userId, title, messages: [] });
  }

  // ── Direct "what should I wear" intent — answer with the real deterministic
  // recommendation pipeline instead of letting the assistant free-associate
  // an outfit disconnected from the wardrobe/scores shown on the dashboard.
  const detectedOccasion = detectOutfitOccasion(userMsg);
  if (detectedOccasion) {
    try {
      const fullUser = await User.findById(userId).lean();
      const session = await recommendationEngine.generateSession(fullUser, {
        occasion: detectedOccasion, requestedBy: 'ai_chat',
      });
      const reply = replyFromRecommendationSession(session, detectedOccasion);
      if (reply) {
        const suggestionsFooter = `\nSUGGESTIONS:["Show me another option","What about accessories?","Add this to my calendar"]`;
        const fullReply = reply + suggestionsFooter;

        conv.messages.push({ role: 'user', content: userMsg });
        conv.messages.push({ role: 'assistant', content: fullReply, recommendationSessionId: session._id });
        conv.lastActivity = new Date();
        await conv.save();

        logBehavior(userId, 'recommendation_view', {
          entityId: session._id, entityType: 'Recommendation',
          metadata: { occasion: detectedOccasion, requestedBy: 'ai_chat' },
        });
        logActivity(userId, {
          action: 'ai_interaction', category: 'ai',
          title: `AI chat generated an outfit for "${detectedOccasion}"`,
          refId: conv._id,
        });

        return res.json({ conversationId: conv._id, message: fullReply, role: 'assistant', provider, recommendationSessionId: session._id });
      }
    } catch (err) {
      console.warn('[aiController] outfit-intent generation failed, falling back to normal chat:', err.message);
      // fall through to normal conversational reply below
    }
  }

  // Build context + system prompt
  const [ctx, weather, insights] = await Promise.all([
    buildContext(userId),
    weatherService.fetchWeather(),
    getUserInsights(userId),
  ]);
  const seasonLabel = kathmandu.getSeasonIntelligence().season;
  const systemPrompt = buildSystemPrompt(req.user, ctx, weather, insights, seasonLabel);

  // Last 20 messages for context
  const history = conv.messages.slice(-20).map(m => ({
    role: m.role, content: m.content,
  }));

  // Call whichever AI provider is configured
  let aiContent;
  try {
    aiContent = await aiProvider.generateChatReply({ systemPrompt, history, userMessage: userMsg })
      || 'I apologize, I could not generate a response. Please try again.';
  } catch (err) {
    console.error('[aiController] chat error:', err.message);
    const msg = err.message || '';
    if (msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('quota')) {
      return res.status(429).json({ message: 'AI quota exceeded. Please wait a few minutes and try again, or check your Gemini API usage limits at aistudio.google.com.' });
    }
    if (msg.includes('401') || msg.includes('API_KEY') || msg.includes('INVALID_ARGUMENT') || msg.includes('Authentication')) {
      return res.status(400).json({ message: 'AI API key is invalid or expired. Check your key in backend/.env.' });
    }
    return res.status(502).json({ message: `AI error: ${msg.split('\n')[0]}` });
  }

  // Grounding check — flags freehand replies that reference a wardrobe item
  // by name which doesn't match anything the user actually owns (see
  // groundingService.js for the heuristic and its documented limitations).
  const { ok: groundingOk, flaggedPhrases } = groundingService.checkGrounding(aiContent, ctx.rawItems);

  // Persist
  conv.messages.push({ role: 'user',      content: userMsg });
  conv.messages.push({ role: 'assistant', content: aiContent, groundingFlag: !groundingOk, flaggedPhrases });
  conv.lastActivity = new Date();
  await conv.save();

  logActivity(userId, {
    action: 'ai_interaction', category: 'ai',
    title:  `AI chat: "${userMsg.slice(0, 50)}${userMsg.length > 50 ? '…' : ''}"`,
    description: `via ${aiProvider.getActiveProviderLabel() || 'AI'}`,
    refId: conv._id,
  });

  res.json({ conversationId: conv._id, message: aiContent, role: 'assistant', provider });
};

exports.deleteConversation = async (req, res) => {
  const conv = await AIConversation.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!conv) return res.status(404).json({ message: 'Conversation not found.' });
  res.json({ message: 'Conversation deleted.' });
};

exports.renameConversation = async (req, res) => {
  const { title } = req.body;
  if (!title?.trim()) return res.status(400).json({ message: 'Title is required.' });
  const conv = await AIConversation.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { title: title.trim().slice(0, 100) },
    { new: true }
  );
  if (!conv) return res.status(404).json({ message: 'Conversation not found.' });
  res.json({ conversation: { _id: conv._id, title: conv.title } });
};
