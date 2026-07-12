'use strict';

const request = require('supertest');
const app = require('../../app');
const AIConversation = require('../../models/AIConversation');
const WardrobeItem = require('../../models/WardrobeItem');
const aiProvider = require('../../services/aiProviderService');
const recommendationEngine = require('../../services/recommendationEngine');

jest.mock('../../services/aiProviderService');
jest.mock('../../services/recommendationEngine');

async function registerAndGetToken(email) {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Chat Test User', email, password: 'StrongP@ss123', consentGiven: 'true',
  });
  return { token: res.body.token, userId: res.body.user.id };
}

beforeEach(() => {
  aiProvider.getActiveProvider.mockReturnValue('gemini');
  aiProvider.getActiveProviderLabel.mockReturnValue('Google Gemini');
});

describe('POST /api/ai/chat — outfit-intent routing persists recommendationSessionId', () => {
  test('an outfit-intent message links the assistant reply to the real session that built it', async () => {
    const { token, userId } = await registerAndGetToken(`chat-outfit-${Date.now()}@example.com`);

    const fakeSessionId = new (require('mongoose').Types.ObjectId)();
    recommendationEngine.generateSession.mockResolvedValue({
      _id: fakeSessionId,
      recommendations: [{
        confidence: 91,
        outfit: { top: { name: 'Blue Shirt', item: 'x' }, bottom: { name: 'Black Jeans', item: 'y' } },
        explanation: { summary: 'Matches your style and today\'s weather.' },
      }],
    });

    const res = await request(app).post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'What should I wear today?' });

    expect(res.status).toBe(200);
    expect(res.body.recommendationSessionId).toBe(String(fakeSessionId));
    expect(recommendationEngine.generateSession).toHaveBeenCalled();
    expect(aiProvider.generateChatReply).not.toHaveBeenCalled();

    const conv = await AIConversation.findOne({ user: userId });
    const assistantMsg = conv.messages.find(m => m.role === 'assistant');
    expect(String(assistantMsg.recommendationSessionId)).toBe(String(fakeSessionId));
  });
});

describe('POST /api/ai/chat — freehand replies run the grounding check', () => {
  test('a freehand reply referencing a real wardrobe item is not flagged', async () => {
    const { token, userId } = await registerAndGetToken(`chat-freehand-ok-${Date.now()}@example.com`);
    await WardrobeItem.create({ user: userId, name: 'Black Leather Jacket', category: 'tops', color: 'black', occasion: 'daily' });

    aiProvider.generateChatReply.mockResolvedValue('Your black leather jacket is a versatile piece for cool evenings.');

    const res = await request(app).post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Give me some styling advice.' });

    expect(res.status).toBe(200);
    const conv = await AIConversation.findOne({ user: userId });
    const assistantMsg = conv.messages.find(m => m.role === 'assistant');
    expect(assistantMsg.groundingFlag).toBe(false);
    expect(assistantMsg.flaggedPhrases).toEqual([]);
  });

  test('a freehand reply referencing an item not in the wardrobe is flagged', async () => {
    const { token, userId } = await registerAndGetToken(`chat-freehand-flag-${Date.now()}@example.com`);
    await WardrobeItem.create({ user: userId, name: 'Black Leather Jacket', category: 'tops', color: 'black', occasion: 'daily' });

    aiProvider.generateChatReply.mockResolvedValue('Your emerald green silk saree would be stunning for the festival.');

    const res = await request(app).post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Give me some styling advice.' });

    expect(res.status).toBe(200);
    const conv = await AIConversation.findOne({ user: userId });
    const assistantMsg = conv.messages.find(m => m.role === 'assistant');
    expect(assistantMsg.groundingFlag).toBe(true);
    expect(assistantMsg.flaggedPhrases.length).toBeGreaterThan(0);
  });
});
