import express from 'express';
import fetch from 'node-fetch';
import sgMail from '@sendgrid/mail';

const app = express();
app.use(express.json());

// 🔐 Variables de entorno (las vas a configurar en Render)
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM = process.env.SENDGRID_FROM; // mail remitente

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

// CORS: permitir que tu web de Firebase llame a la API
app.use((req, res, next) => {
  // Cambiá esta URL por tu dominio real de Firebase cuando lo tengas
  const allowedOrigin = 'https://TU-PROJECTO.web.app';

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// 1) TELEGRAM - enviar recordatorio
app.post('/api/send-telegram', async (req, res) => {
  try {
    const { chatId, text } = req.body;
    if (!chatId || !text) {
      return res.status(400).json({ error: 'Faltan chatId o text' });
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
    const data = await resp.json();
    return res.json({ ok: true, data });
  } catch (err) {
    console.error('Error Telegram:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 2) MERCADOPAGO - crear preferencia de pago
app.post('/api/create-payment', async (req, res) => {
  try {
    const { title, quantity, unit_price, external_reference } = req.body;

    const mpResp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: [
          {
            title,
            quantity,
            unit_price
          }
        ],
        external_reference
      })
    });

    const data = await mpResp.json();
    return res.json(data);
  } catch (err) {
    console.error('Error MP:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 3) SENDGRID - enviar email
app.post('/api/send-email', async (req, res) => {
  try {
    const { to, subject, text } = req.body;
    if (!to || !subject || !text) {
      return res.status(400).json({ error: 'Falta to/subject/text' });
    }

    const msg = {
      to,
      from: SENDGRID_FROM,
      subject,
      text
    };

    await sgMail.send(msg);
    return res.json({ ok: true });
  } catch (err) {
    console.error('Error SendGrid:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Dentasoft API corriendo en puerto', PORT);
});
