// maxApi.js — HTTP-обёртка для Max REST API
import axios from 'axios';
import FormData from 'form-data';
import { config } from './config.js';
import { logger } from './logger.js';

const BASE = 'https://platform-api.max.ru';

const client = axios.create({
  baseURL: BASE,
  headers: { Authorization: config.MAX_BOT_TOKEN },
  timeout: 60_000,
});

// Retry on 429 (rate limit)
client.interceptors.response.use(null, async (error) => {
  if (error.response?.status === 429) {
    const retryAfter = parseInt(error.response.headers['retry-after'] || '1', 10);
    logger.warn(`Rate limited, retrying after ${retryAfter}s`);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return client.request(error.config);
  }
  throw error;
});

export const maxApi = {
  // === Bot ===
  async getMe() {
    const { data } = await client.get('/me');
    return data;
  },

  // === Messages ===
  async sendMessage(userId, body) {
    const params = { user_id: userId };
    const { data } = await client.post('/messages', body, { params });
    return data;
  },

  async sendChatMessage(chatId, body) {
    const params = { chat_id: chatId };
    const { data } = await client.post('/messages', body, { params });
    return data;
  },

  async editMessage(messageId, body) {
    const params = { message_id: messageId };
    const { data } = await client.put('/messages', body, { params });
    return data;
  },

  async deleteMessage(messageId) {
    const params = { message_id: messageId };
    const { data } = await client.delete('/messages', { params });
    return data;
  },

  // === Callbacks ===
  async answerCallback(callbackId, text = null) {
    const body = {};
    if (text) body.message = { text };
    const { data } = await client.post('/answers', body, {
      params: { callback_id: callbackId },
    });
    return data;
  },

  async answerCallbackNotification(callbackId, text) {
    const body = { notification: text };
    const { data } = await client.post('/answers', body, {
      params: { callback_id: callbackId },
    });
    return data;
  },

  // === Actions ===
  async sendAction(chatId, action = 'typing_on') {
    const { data } = await client.post(`/chats/${chatId}/actions`, { action });
    return data;
  },

  // === Members ===
  async getMembers(chatId, userIds = null) {
    const params = {};
    if (userIds) params.user_ids = userIds;
    const { data } = await client.get(`/chats/${chatId}/members`, { params });
    return data;
  },

  // === Uploads ===
  async getUploadUrl(type = 'video') {
    const { data } = await client.post('/uploads', null, {
      params: { type },
    });
    return data; // { url, token? }
  },

  async uploadFile(uploadUrl, fileStream, filename) {
    const form = new FormData();
    form.append('data', fileStream, filename);
    const { data } = await axios.post(uploadUrl, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 120_000, // 2 min timeout for large file uploads
    });
    return data; // may contain { token } for image/file types
  },

  // === Polling ===
  async getUpdates(marker = null, timeout = 30, types = null) {
    const params = { timeout };
    if (marker != null) params.marker = marker;
    if (types) params.types = types.join(',');
    const { data } = await client.get('/updates', {
      params,
      timeout: (timeout + 10) * 1000, // axios timeout > polling timeout
    });
    return data; // { updates: [], marker }
  },
};
