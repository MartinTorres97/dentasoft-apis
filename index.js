import express from 'express';
import fetch from 'node-fetch';
import sgMail from '@sendgrid/mail';

const app = express();
app.use(express.json());

// ======================
// Página de prueba
// ======================
app.get("/", (req, res) => {
  res.send("Dentasoft APIs funcionando");
});

// 🔐 Variables de entorno
const TELEGRAM_TOKEN   = process.env.TELEGRAM_TOKEN;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM    = process.env.SENDGRID_FROM; // mail remitente

// Inicializar SendGrid
if (SENDGRID_API_KEY) {
  try {
    sgMail.setApiKey(SENDGRID_API_KEY);
    console.log("SendGrid API key configurada.");
  } catch (e) {
    console.error("Error configurando SendGrid API key:", e);
  }
} else {
  console.warn("SENDGRID_API_KEY no está definida en las variables de entorno.");
}

// =====================
// CORS (Firebase + local)
// =====================
const allowedOrigins = [
  'https://dentasoft-8f0a8.web.app',
  'https://dentasoft-8f0a8.firebaseapp.com',
  'http://127.0.0.1:5501',
  'http://localhost:5501'
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
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
    console.log('REQ BODY /api/avisos/email =>', req.body);

    const { email, nombre, apellido, fecha, hora, odontologoNombre } = req.body || {};

    if (!email) {
      return res.status(400).json({
        ok: false,
        error: 'Falta email del paciente en el body',
        bodyRecibido: req.body
      });
    }

    if (!SENDGRID_API_KEY || !SENDGRID_FROM) {
      return res.status(500).json({
        ok: false,
        error: 'SENDGRID_API_KEY o SENDGRID_FROM no configurados en el servidor'
      });
    }

    const fromEmail      = (SENDGRID_FROM || '').trim();
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
      from: fromEmail,
      subject,
      text
    };

    console.log('Enviando mail con SendGrid:', msg);

    await sgMail.send(msg);

    return res.json({ ok: true, message: 'Email enviado correctamente' });

  } catch (err) {
    console.error('Error SendGrid:', err);

    let detalle = err.message || 'Error desconocido';

    if (err.response && err.response.body && Array.isArray(err.response.body.errors)) {
      const e0 = err.response.body.errors[0];
      if (e0 && e0.message) {
        detalle = e0.message;
      }
    }

    console.error('SendGrid mensaje:', detalle);

    return res.status(400).json({
      ok: false,
      error: detalle
    });
  }
});

// ======================
// Servidor
// ======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Dentasoft API corriendo en puerto', PORT);
});
