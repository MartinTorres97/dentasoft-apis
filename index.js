import express from 'express';
import fetch from 'node-fetch';
import sgMail from '@sendgrid/mail';

const app = express();
app.use(express.json());

// Página de prueba
app.get("/", (req, res) => {
  res.send("Dentasoft APIs funcionando");
});

// 🔐 Variables de entorno
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM = process.env.SENDGRID_FROM; // mail remitente

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

// =====================
// CORS (Firebase + local)
// =====================
const allowedOrigins = [
  'https://dentasoft-8f0a8.web.app',
  'http://127.0.0.1:5501'
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // Por seguridad, si viene de otro origen no lo autorizamos
    res.setHeader('Access-Control-Allow-Origin', 'https://dentasoft-8f0a8.web.app');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ==========================================
// 1) TELEGRAM - enviar recordatorio de turno
//    Ruta que matchea con el front:
//    POST /api/avisos/telegram
// ==========================================
app.post('/api/avisos/telegram', async (req, res) => {
  try {
    const { chatId, nombre, apellido, fecha, hora, odontologoNombre } = req.body;

    if (!chatId) {
      return res.status(400).json({ error: 'Falta chatId' });
    }

    if (!TELEGRAM_TOKEN) {
      return res.status(500).json({ error: 'TELEGRAM_TOKEN no está configurado en el servidor' });
    }

    const nombreCompleto = [nombre, apellido].filter(Boolean).join(' ');
    const texto = `
Hola ${nombreCompleto || 'paciente'} 👋

Le recordamos su turno odontológico:

🗓 Fecha: ${fecha || '-'}
⏰ Hora: ${hora || '-'}
👨‍⚕️ Profesional: ${odontologoNombre || '-'}

Si no puede asistir, por favor comuníquese con el consultorio.
    `.trim();

    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: texto })
    });

    const data = await resp.json();
    if (!data.ok) {
      console.error('Error en la API de Telegram:', data);
      return res.status(500).json({ ok: false, error: 'Telegram API error', data });
    }

    return res.json({ ok: true, data });

  } catch (err) {
    console.error('Error Telegram:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ==========================================
// 2) SENDGRID - enviar email de recordatorio
//    Ruta que matchea con el front:
//    POST /api/avisos/email
// ==========================================
app.post('/api/avisos/email', async (req, res) => {
  try {
    const { email, nombre, apellido, fecha, hora, odontologoNombre } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Falta email del paciente' });
    }

    if (!SENDGRID_API_KEY || !SENDGRID_FROM) {
      return res.status(500).json({ error: 'SENDGRID_API_KEY o SENDGRID_FROM no configurados en el servidor' });
    }

    const nombreCompleto = [nombre, apellido].filter(Boolean).join(' ');

    const subject = 'Recordatorio de turno odontológico - Dentasoft';
    const text = `
Hola ${nombreCompleto || 'paciente'},

Le recordamos su próximo turno odontológico:

🗓 Fecha: ${fecha || '-'}
⏰ Hora: ${hora || '-'}
👨‍⚕️ Profesional: ${odontologoNombre || '-'}

Si necesita reprogramar o cancelar el turno, por favor comuníquese con el consultorio.

Saludos,
Equipo Dentasoft
    `.trim();

    const msg = {
      to: email,
      from: SENDGRID_FROM,
      subject,
      text
    };

    await sgMail.send(msg);
    return res.json({ ok: true, message: 'Email enviado correctamente' });

  } catch (err) {
    console.error('Error SendGrid:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ======================
// Servidor
// ======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Dentasoft API corriendo en puerto', PORT);
});
