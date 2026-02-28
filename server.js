const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const TELEGRAM_CONFIG = {
  admin: {
    botToken: 'REPLACE_WITH_ADMIN_BOT_TOKEN',
    chatId: 'REPLACE_WITH_ADMIN_CHAT_ID',
  },
  user: {
    botToken: 'REPLACE_WITH_USER_BOT_TOKEN',
    chatId: 'REPLACE_WITH_USER_CHAT_ID',
  },
};

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function escapeMarkdown(value) {
  return String(value || '')
    .replace(/[_*\[\]()~`>#+\-=|{}.!]/g, '\\$&')
    .trim();
}

async function sendTelegramMessage(botToken, chatId, text) {
  if (!botToken || !chatId) {
    return;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram API error (${response.status}): ${body}`);
  }
}

function buildMessage({ payload, req }) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const ua = req.get('user-agent') || 'unknown';
  const geo = payload.geolocation || {};

  return [
    '*Nouvelle demande de vérification utilisateur*',
    `Date: ${escapeMarkdown(new Date().toISOString())}`,
    `Page: ${escapeMarkdown(payload.page)}`,
    `Type: ${escapeMarkdown(payload.eventType)}`,
    `Référence: ${escapeMarkdown(payload.reference || 'n/a')}`,
    `Email: ${escapeMarkdown(payload.email || 'n/a')}`,
    `Sujet: ${escapeMarkdown(payload.subject || 'n/a')}`,
    `Message: ${escapeMarkdown(payload.message || 'n/a')}`,
    `Recherche FAQ: ${escapeMarkdown(payload.term || payload.faqSearchTerm || 'n/a')}`,
    `Consentement: ${escapeMarkdown(payload.consentGranted ? 'oui' : 'non')}`,
    `IP: ${escapeMarkdown(ip)}`,
    `User-Agent: ${escapeMarkdown(ua)}`,
    `Latitude: ${escapeMarkdown(geo.latitude ?? 'n/a')}`,
    `Longitude: ${escapeMarkdown(geo.longitude ?? 'n/a')}`,
    `Précision: ${escapeMarkdown(geo.accuracy ?? 'n/a')}`,
    `Geo disponible: ${escapeMarkdown(geo.available ?? false)}`,
    `Raison Geo: ${escapeMarkdown(geo.reason || 'n/a')}`,
  ].join('\n');
}

async function notifyBothBots(payload, req) {
  const message = buildMessage({ payload, req });

  await Promise.all([
    sendTelegramMessage(
      TELEGRAM_CONFIG.admin.botToken !== 'REPLACE_WITH_ADMIN_BOT_TOKEN'
        ? TELEGRAM_CONFIG.admin.botToken
        : process.env.ADMIN_BOT_TOKEN,
      TELEGRAM_CONFIG.admin.chatId !== 'REPLACE_WITH_ADMIN_CHAT_ID'
        ? TELEGRAM_CONFIG.admin.chatId
        : process.env.ADMIN_CHAT_ID,
      message
    ),
    sendTelegramMessage(
      TELEGRAM_CONFIG.user.botToken !== 'REPLACE_WITH_USER_BOT_TOKEN'
        ? TELEGRAM_CONFIG.user.botToken
        : process.env.USER_BOT_TOKEN,
      TELEGRAM_CONFIG.user.chatId !== 'REPLACE_WITH_USER_CHAT_ID'
        ? TELEGRAM_CONFIG.user.chatId
        : process.env.USER_CHAT_ID,
      message
    ),
  ]);
}

app.post('/api/support-request', async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.email || !payload.subject || !payload.message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!payload.consentGranted) {
      return res.status(400).json({ error: 'Consent is required' });
    }

    await notifyBothBots(payload, req);
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error while sending request' });
  }
});

app.post('/api/events/:eventName', async (req, res) => {
  try {
    const payload = {
      ...(req.body || {}),
      eventType: req.params.eventName,
    };

    await notifyBothBots(payload, req);
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Event capture failed' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
