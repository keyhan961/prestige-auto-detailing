import 'dotenv/config';
import express from 'express';
import nodemailer from 'nodemailer';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const app = express();
const port = process.env.PORT || 3001;
const companyEmail = process.env.COMPANY_EMAIL || 'detailinga028@gmail.com';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../dist');
const dataDir = path.resolve(__dirname, 'data');
const appointmentsFile = path.join(dataDir, 'appointments.json');
const businessTimeZone = process.env.BUSINESS_TIME_ZONE || 'Europe/Helsinki';

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

function required(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function getBaseUrl() {
  return (process.env.PUBLIC_BASE_URL || `http://localhost:${port}`).replace(/\/$/, '');
}

async function readAppointments() {
  try {
    const raw = await fs.readFile(appointmentsFile, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

async function writeAppointments(appointments) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(appointmentsFile, JSON.stringify(appointments, null, 2));
}

function customerDecisionText(status, appointment) {
  const service = appointment.service || 'your selected service';
  const date = appointment.preferredDate || 'your requested date';
  const time = appointment.preferredTime ? ` at ${appointment.preferredTime}` : '';

  if (status === 'confirmed') {
    return [
      `Hello ${appointment.name},`,
      '',
      `Your appointment request for ${service} on ${date}${time} has been confirmed.`,
      '',
      'Prestige Auto Detailing',
    ].join('\n');
  }

  return [
    `Hello ${appointment.name},`,
    '',
    `Your appointment request for ${service} on ${date}${time} could not be confirmed for that time.`,
    'Please contact us to choose another available time.',
    '',
    'Prestige Auto Detailing',
  ].join('\n');
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function emailShell(title, intro, detailsHtml, buttons = []) {
  const buttonHtml = buttons
    .map(
      (button) =>
        `<a href="${escapeHtml(button.url)}" style="display:inline-block;margin:8px 8px 8px 0;padding:13px 18px;border-radius:999px;background:${escapeHtml(button.color || '#e21b23')};color:#fff;text-decoration:none;font-weight:700;">${escapeHtml(button.label)}</a>`,
    )
    .join('');

  return `<!doctype html>
    <html>
      <body style="margin:0;background:#050505;color:#f5f5f3;font-family:Arial,sans-serif;">
        <div style="max-width:680px;margin:0 auto;padding:28px 16px;">
          <div style="border:1px solid rgba(255,255,255,.16);border-radius:16px;background:#111;padding:28px;">
            <p style="margin:0 0 10px;color:#e21b23;font-weight:700;letter-spacing:.16em;text-transform:uppercase;">Prestige Auto Detailing</p>
            <h1 style="margin:0 0 18px;color:#fff;font-size:26px;">${escapeHtml(title)}</h1>
            <p style="color:#d7d7d7;line-height:1.6;">${escapeHtml(intro).replaceAll('\n', '<br>')}</p>
            <div style="margin:22px 0;padding:18px;border-radius:12px;background:#050505;border:1px solid rgba(255,255,255,.12);color:#e8e8e8;line-height:1.7;">${detailsHtml}</div>
            ${buttonHtml ? `<div style="margin-top:22px;">${buttonHtml}</div>` : ''}
          </div>
        </div>
      </body>
    </html>`;
}

function appointmentDetailsHtml(appointment) {
  return [
    `<strong>Customer:</strong> ${escapeHtml(appointment.name || '-')}`,
    `<strong>Email:</strong> ${escapeHtml(appointment.email || '-')}`,
    `<strong>Phone:</strong> ${escapeHtml(appointment.phone || '-')}`,
    `<strong>Vehicle:</strong> ${escapeHtml([appointment.vehicleMake, appointment.vehicleModel].filter(Boolean).join(' ') || '-')}`,
    `<strong>Service:</strong> ${escapeHtml(appointment.service || '-')}`,
    `<strong>Duration:</strong> ${escapeHtml(normalizeDurationMinutes(appointment.durationMinutes))} minutes`,
    `<strong>Date:</strong> ${escapeHtml(appointment.preferredDate || '-')}`,
    `<strong>Time:</strong> ${escapeHtml(appointment.preferredTime || '-')}`,
    `<strong>Message:</strong><br>${escapeHtml(appointment.message || '-').replaceAll('\n', '<br>')}`,
  ].join('<br>');
}

function ownerDenyPage(appointment, token) {
  return `
    <html>
      <body style="background:#050505;color:#f5f5f3;font-family:Arial,sans-serif;padding:24px;">
        <main style="max-width:680px;margin:auto;border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:28px;background:#111;">
          <h1 style="color:#e21b23;margin-top:0;">Deny or suggest another time</h1>
          <p><strong>Customer:</strong> ${escapeHtml(appointment.name)}<br>
          <strong>Email:</strong> ${escapeHtml(appointment.email)}<br>
          <strong>Phone:</strong> ${escapeHtml(appointment.phone)}</p>
          <p><strong>Requested service:</strong> ${escapeHtml(appointment.service)}<br>
          <strong>Requested date:</strong> ${escapeHtml(appointment.preferredDate || '-')}</p>

          <form method="POST" action="/api/appointments/${appointment.id}/deny" style="display:grid;gap:16px;margin-top:24px;">
            <input type="hidden" name="token" value="${escapeHtml(token)}" />
            <label style="display:grid;gap:8px;">
              Suggested new date
              <input name="suggestedDate" type="date" style="padding:12px;border-radius:8px;border:1px solid #444;background:#050505;color:#fff;" />
            </label>
            <label style="display:grid;gap:8px;">
              Suggested new time
              <input name="suggestedTime" type="time" style="padding:12px;border-radius:8px;border:1px solid #444;background:#050505;color:#fff;" />
            </label>
            <label style="display:grid;gap:8px;">
              Message to customer
              <textarea name="ownerMessage" rows="5" style="padding:12px;border-radius:8px;border:1px solid #444;background:#050505;color:#fff;">The requested time is not available. We can offer this alternative appointment time.</textarea>
            </label>
            <div style="display:flex;flex-wrap:wrap;gap:12px;">
              <button name="action" value="suggest" style="border:0;border-radius:999px;background:#e21b23;color:#fff;padding:12px 18px;font-weight:700;cursor:pointer;">Send alternative time</button>
              <button name="action" value="deny" style="border:1px solid #555;border-radius:999px;background:transparent;color:#fff;padding:12px 18px;font-weight:700;cursor:pointer;">Deny without alternative</button>
            </div>
          </form>
        </main>
      </body>
    </html>
  `;
}

function customerReschedulePage(appointment, token) {
  return `
    <html>
      <body style="background:#050505;color:#f5f5f3;font-family:Arial,sans-serif;padding:24px;">
        <main style="max-width:680px;margin:auto;border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:28px;background:#111;">
          <h1 style="color:#e21b23;margin-top:0;">Request another appointment time</h1>
          <p>If the suggested time does not work for you, send another date and time. The owner will confirm it or suggest another option.</p>
          <p><strong>Service:</strong> ${escapeHtml(appointment.service)}<br>
          <strong>Current suggested date:</strong> ${escapeHtml(appointment.suggestedDate || '-')}<br>
          <strong>Current suggested time:</strong> ${escapeHtml(appointment.suggestedTime || '-')}</p>

          <form method="POST" action="/api/appointments/${appointment.id}/reschedule" style="display:grid;gap:16px;margin-top:24px;">
            <input type="hidden" name="token" value="${escapeHtml(token)}" />
            <label style="display:grid;gap:8px;">
              Your preferred date
              <input name="preferredDate" type="date" required style="padding:12px;border-radius:8px;border:1px solid #444;background:#050505;color:#fff;" />
            </label>
            <label style="display:grid;gap:8px;">
              Your preferred time
              <input name="preferredTime" type="time" required style="padding:12px;border-radius:8px;border:1px solid #444;background:#050505;color:#fff;" />
            </label>
            <label style="display:grid;gap:8px;">
              Message
              <textarea name="customerMessage" rows="5" style="padding:12px;border-radius:8px;border:1px solid #444;background:#050505;color:#fff;">This time does not work for me. Can we try this date and time instead?</textarea>
            </label>
            <button style="border:0;border-radius:999px;background:#e21b23;color:#fff;padding:12px 18px;font-weight:700;cursor:pointer;">Send new requested time</button>
          </form>
        </main>
      </body>
    </html>
  `;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function addHoursToTime(time, hours) {
  const [rawHours = '0', rawMinutes = '0'] = String(time || '09:00').split(':');
  const date = new Date(2000, 0, 1, Number(rawHours), Number(rawMinutes));
  date.setHours(date.getHours() + hours);
  return `${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

function addHoursToDateTime(date, time, hours) {
  const [year, month, day] = String(date || '').split('-').map(Number);
  const [rawHours = '9', rawMinutes = '0'] = String(time || '09:00').split(':').map(Number);
  const value = new Date(year, month - 1, day, rawHours, rawMinutes);
  value.setHours(value.getHours() + hours);
  return value;
}

function addMinutesToDateTime(date, time, minutesToAdd) {
  const [year, month, day] = String(date || '').split('-').map(Number);
  const [rawHours = '9', rawMinutes = '0'] = String(time || '09:00').split(':').map(Number);
  const value = new Date(year, month - 1, day, rawHours, rawMinutes);
  value.setMinutes(value.getMinutes() + minutesToAdd);
  return value;
}

function googleCalendarDate(value) {
  return value.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function getTimeZoneOffset(date, time, timeZone) {
  const [year, month, day] = String(date || '').split('-').map(Number);
  const [hour, minute] = String(time || '09:00').split(':').map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  });
  const offsetName = formatter.formatToParts(utcGuess).find((part) => part.type === 'timeZoneName')?.value || 'GMT+0';
  const match = offsetName.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);

  if (!match) {
    return '+00:00';
  }

  const sign = match[1];
  const hours = pad(match[2]);
  const minutes = match[3] || '00';

  return `${sign}${hours}:${minutes}`;
}

function localDateTimeWithOffset(date, time, minutesToAdd = 0) {
  const [rawHours = '9', rawMinutes = '0'] = String(time || '09:00').split(':').map(Number);
  const value = new Date(2000, 0, 1, rawHours, rawMinutes);
  value.setMinutes(value.getMinutes() + minutesToAdd);
  const nextTime = `${pad(value.getHours())}:${pad(value.getMinutes())}`;

  return `${date}T${nextTime}:00${getTimeZoneOffset(date, nextTime, businessTimeZone)}`;
}

function normalizeDurationMinutes(value) {
  const duration = Number(value);

  if (!Number.isFinite(duration) || duration <= 0) {
    return 120;
  }

  return Math.min(duration, 1440);
}

function icsDate(date) {
  return String(date || '').replaceAll('-', '');
}

function icsEscape(value) {
  return String(value || '')
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;');
}

function createOwnerCalendarEvent(appointment) {
  const date = icsDate(appointment.preferredDate);
  const time = appointment.preferredTime ? appointment.preferredTime.replace(':', '') + '00' : '';
  const durationMinutes = normalizeDurationMinutes(appointment.durationMinutes);
  const uid = `${appointment.id}@prestige-auto-detailing`;
  const summary = `Prestige detail: ${appointment.name}`;
  const vehicle = [appointment.vehicleMake, appointment.vehicleModel].filter(Boolean).join(' ') || '-';
  const description = [
    `Customer: ${appointment.name}`,
    `Phone: ${appointment.phone}`,
    `Email: ${appointment.email}`,
    `Vehicle: ${vehicle}`,
    `Service: ${appointment.service}`,
    `Duration: ${durationMinutes} minutes`,
    appointment.message ? `Message: ${appointment.message}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const endTime = addMinutesToDateTime(appointment.preferredDate, appointment.preferredTime, durationMinutes).toTimeString().slice(0, 8).replaceAll(':', '');
  const dateFields = time
    ? [`DTSTART:${date}T${time}`, `DTEND:${date}T${endTime}`]
    : [`DTSTART;VALUE=DATE:${date}`, `DTEND;VALUE=DATE:${date}`];

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Prestige Auto Detailing//Appointment//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    ...dateFields,
    `SUMMARY:${icsEscape(summary)}`,
    `LOCATION:${icsEscape(process.env.BUSINESS_ADDRESS || 'Läntinen teollisuuskatu 23, 02920 Espoo')}`,
    `DESCRIPTION:${icsEscape(description)}`,
    'STATUS:CONFIRMED',
    `ORGANIZER;CN=Prestige Auto Detailing:mailto:${process.env.MAIL_FROM || process.env.SMTP_USER}`,
    `ATTENDEE;CN=Prestige Auto Detailing;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${companyEmail}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

function createGoogleCalendarUrl(appointment) {
  const start = addHoursToDateTime(appointment.preferredDate, appointment.preferredTime, 0);
  const end = addMinutesToDateTime(appointment.preferredDate, appointment.preferredTime, normalizeDurationMinutes(appointment.durationMinutes));
  const vehicle = [appointment.vehicleMake, appointment.vehicleModel].filter(Boolean).join(' ') || '-';
  const details = [
    `Customer: ${appointment.name}`,
    `Phone: ${appointment.phone}`,
    `Email: ${appointment.email}`,
    `Vehicle: ${vehicle}`,
    `Service: ${appointment.service}`,
    `Duration: ${normalizeDurationMinutes(appointment.durationMinutes)} minutes`,
    appointment.message ? `Message: ${appointment.message}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Prestige detail: ${appointment.name}`,
    dates: `${googleCalendarDate(start)}/${googleCalendarDate(end)}`,
    details,
    location: process.env.BUSINESS_ADDRESS || 'Läntinen teollisuuskatu 23, 02920 Espoo',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function getGoogleCredentials() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }

  return null;
}

async function createOwnerCalendarEventDirectly(appointment) {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const credentials = getGoogleCredentials();

  if (!calendarId || !credentials) {
    return null;
  }

  const auth = new google.auth.GoogleAuth({
    credentials: typeof credentials === 'string' ? undefined : credentials,
    keyFile: typeof credentials === 'string' ? credentials : undefined,
    scopes: ['https://www.googleapis.com/auth/calendar.events'],
  });
  const calendar = google.calendar({ version: 'v3', auth });
  const vehicle = [appointment.vehicleMake, appointment.vehicleModel].filter(Boolean).join(' ') || '-';
  const startDateTime = `${appointment.preferredDate}T${appointment.preferredTime}:00`;
  const end = addMinutesToDateTime(appointment.preferredDate, appointment.preferredTime, normalizeDurationMinutes(appointment.durationMinutes));
  const endDateTime = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}:00`;

  const response = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: `Prestige detail: ${appointment.name}`,
      location: process.env.BUSINESS_ADDRESS || 'Läntinen teollisuuskatu 23, 02920 Espoo',
      description: [
        `Customer: ${appointment.name}`,
        `Phone: ${appointment.phone}`,
        `Email: ${appointment.email}`,
        `Vehicle: ${vehicle}`,
        `Service: ${appointment.service}`,
        `Duration: ${normalizeDurationMinutes(appointment.durationMinutes)} minutes`,
        appointment.message ? `Message: ${appointment.message}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      start: {
        dateTime: startDateTime,
        timeZone: businessTimeZone,
      },
      end: {
        dateTime: endDateTime,
        timeZone: businessTimeZone,
      },
      reminders: {
        useDefault: true,
      },
    },
  });

  return response.data;
}

function createCalendarClient() {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const credentials = getGoogleCredentials();

  if (!calendarId || !credentials) {
    return null;
  }

  const auth = new google.auth.GoogleAuth({
    credentials: typeof credentials === 'string' ? undefined : credentials,
    keyFile: typeof credentials === 'string' ? credentials : undefined,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  return {
    calendarId,
    calendar: google.calendar({ version: 'v3', auth }),
  };
}

async function isCalendarSlotAvailable(preferredDate, preferredTime, durationMinutes) {
  const client = createCalendarClient();

  if (!client || !required(preferredDate) || !required(preferredTime)) {
    return { available: true, configured: Boolean(client) };
  }

  const start = addHoursToDateTime(preferredDate, preferredTime, 0);
  const response = await client.calendar.freebusy.query({
    requestBody: {
      timeMin: localDateTimeWithOffset(preferredDate, preferredTime),
      timeMax: localDateTimeWithOffset(preferredDate, preferredTime, normalizeDurationMinutes(durationMinutes)),
      timeZone: businessTimeZone,
      items: [{ id: client.calendarId }],
    },
  });
  const busy = response.data.calendars?.[client.calendarId]?.busy || [];

  return {
    available: busy.length === 0,
    configured: true,
    busy,
  };
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
    },
  });
}

app.post('/api/appointments', async (req, res) => {
  try {
    const { name, email, phone, vehicleMake, vehicleModel, service, durationMinutes, preferredDate, preferredTime, message, language } = req.body || {};

    if (!required(name) || !required(email) || !required(phone) || !required(service) || !required(preferredDate) || !required(preferredTime)) {
      return res.status(400).json({ message: 'Name, email, phone, service, preferred date, and preferred time are required.' });
    }

    const normalizedDuration = normalizeDurationMinutes(durationMinutes);
    const availability = await isCalendarSlotAvailable(preferredDate, preferredTime, normalizedDuration);

    if (!availability.available) {
      return res.status(409).json({ message: 'That date and time is already booked.' });
    }

    const transporter = createTransporter();

    if (!transporter) {
      console.log('Appointment request received without SMTP configuration:', req.body);
      return res.status(503).json({
        message: 'Email sending is not configured on the server yet.',
      });
    }

    const appointment = {
      id: crypto.randomUUID(),
      token: crypto.randomBytes(24).toString('hex'),
      customerToken: crypto.randomBytes(24).toString('hex'),
      status: 'pending',
      createdAt: new Date().toISOString(),
      language: language || 'not specified',
      name,
      email,
      phone,
      vehicleMake: vehicleMake || '',
      vehicleModel: vehicleModel || '',
      service,
      durationMinutes: normalizedDuration,
      preferredDate: preferredDate || '',
      preferredTime: preferredTime || '',
      message: message || '',
    };

    const appointments = await readAppointments();
    appointments.push(appointment);
    await writeAppointments(appointments);

    const baseUrl = getBaseUrl();
    const confirmUrl = `${baseUrl}/api/appointments/${appointment.id}/confirm?token=${appointment.token}`;
    const denyUrl = `${baseUrl}/api/appointments/${appointment.id}/deny?token=${appointment.token}`;
    const buttons = [
      { label: 'Confirm appointment', url: confirmUrl, color: '#16a34a' },
      { label: 'Deny or suggest new time', url: denyUrl, color: '#e21b23' },
    ];

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: companyEmail,
      replyTo: email,
      subject: 'Prestige Auto Detailing - Appointment Request',
      html: emailShell(
        'New Appointment Request',
        'A customer requested an appointment. Choose one of the actions below.',
        appointmentDetailsHtml(appointment),
        buttons,
      ),
    });

    return res.json({ message: 'Appointment request sent.' });
  } catch (error) {
    console.error('Appointment email failed:', error);
    return res.status(500).json({ message: 'Could not send appointment request.' });
  }
});

app.post('/api/availability', async (req, res) => {
  try {
    const { preferredDate, preferredTime, durationMinutes } = req.body || {};

    if (!required(preferredDate) || !required(preferredTime)) {
      return res.status(400).json({ message: 'Preferred date and time are required.' });
    }

    const availability = await isCalendarSlotAvailable(preferredDate, preferredTime, durationMinutes);

    return res.json({
      available: availability.available,
      configured: availability.configured,
      message: availability.available ? 'Time is available.' : 'That date and time is already booked.',
    });
  } catch (error) {
    console.error('Availability check failed:', error);
    return res.status(500).json({ message: 'Could not check availability.' });
  }
});

app.get('/api/appointments/:id/:decision', async (req, res) => {
  try {
    const { id, decision } = req.params;
    const { token } = req.query;

    if (decision === 'reschedule') {
      const appointments = await readAppointments();
      const appointment = appointments.find((item) => item.id === id);

      if (!appointment || appointment.customerToken !== token) {
        return res.status(404).send('Appointment link is invalid.');
      }

      if (!['alternative_sent', 'customer_reschedule_requested'].includes(appointment.status)) {
        return res.send(`
          <html><body style="font-family: Arial, sans-serif; padding: 40px;">
            <h1>Cannot request another time</h1>
            <p>This appointment is currently marked as <strong>${escapeHtml(appointment.status)}</strong>.</p>
          </body></html>
        `);
      }

      return res.send(customerReschedulePage(appointment, token));
    }

    if (!['confirm', 'deny'].includes(decision)) {
      return res.status(400).send('Invalid appointment action.');
    }

    const appointments = await readAppointments();
    const appointment = appointments.find((item) => item.id === id);

    if (!appointment || appointment.token !== token) {
      return res.status(404).send('Appointment action link is invalid.');
    }

    if (!['pending', 'customer_reschedule_requested'].includes(appointment.status)) {
      return res.send(`
        <html><body style="font-family: Arial, sans-serif; padding: 40px;">
          <h1>Already handled</h1>
          <p>This appointment is already marked as <strong>${appointment.status}</strong>.</p>
        </body></html>
      `);
    }

    if (decision === 'deny') {
      return res.send(ownerDenyPage(appointment, token));
    }

    const status = 'confirmed';
    appointment.status = status;
    appointment.updatedAt = new Date().toISOString();

    const transporter = createTransporter();

    if (!transporter) {
      return res.status(503).send('Appointment updated, but email sending is not configured.');
    }

    let directCalendarEvent = null;
    let directCalendarError = null;

    try {
      directCalendarEvent = await createOwnerCalendarEventDirectly(appointment);
      if (directCalendarEvent?.id) {
        appointment.calendarEventId = directCalendarEvent.id;
        appointment.calendarEventLink = directCalendarEvent.htmlLink || '';
      }
    } catch (error) {
      directCalendarError = error;
      console.error('Direct Google Calendar event creation failed:', error);
    }

    await writeAppointments(appointments);

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: appointment.email,
      replyTo: companyEmail,
      subject: status === 'confirmed' ? 'Your Prestige Auto Detailing appointment is confirmed' : 'Prestige Auto Detailing appointment time update',
      text: customerDecisionText(status, appointment),
    });

    const calendarEvent = createOwnerCalendarEvent(appointment);
    const googleCalendarUrl = createGoogleCalendarUrl(appointment);

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: companyEmail,
      subject: `Calendar event: ${appointment.name} - ${appointment.service}`,
      text: [
        'The appointment was confirmed.',
        '',
        directCalendarEvent
          ? 'The appointment was automatically added to the owner Google Calendar.'
          : 'Automatic Google Calendar saving is not configured or failed. A calendar invite is attached. On phone, tap the invite or use this Google Calendar link:',
        googleCalendarUrl,
        directCalendarError ? `Calendar API error: ${directCalendarError.message || directCalendarError}` : '',
        '',
        `Customer: ${appointment.name}`,
        `Phone: ${appointment.phone}`,
        `Vehicle: ${[appointment.vehicleMake, appointment.vehicleModel].filter(Boolean).join(' ') || '-'}`,
        `Service: ${appointment.service}`,
        `Duration: ${normalizeDurationMinutes(appointment.durationMinutes)} minutes`,
        `Date: ${appointment.preferredDate}`,
        `Time: ${appointment.preferredTime}`,
      ].join('\n'),
      icalEvent: {
        method: 'REQUEST',
        content: calendarEvent,
      },
      attachments: [
        {
          filename: `prestige-appointment-${appointment.id}.ics`,
          content: calendarEvent,
          contentType: 'text/calendar; charset=utf-8; method=REQUEST',
        },
      ],
    });

    return res.send(`
      <html>
        <body style="background:#050505;color:#f5f5f3;font-family:Arial,sans-serif;padding:40px;">
          <main style="max-width:640px;margin:auto;border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:28px;background:#111;">
            <h1 style="color:#e21b23;margin-top:0;">Appointment ${status}</h1>
            <p>The customer has been emailed. ${
              directCalendarEvent
                ? 'The appointment was automatically saved in the owner Google Calendar.'
                : 'A calendar invite was also sent to the owner email.'
            }</p>
            <p><a href="${googleCalendarUrl}" target="_blank" rel="noreferrer" style="color:#e21b23;">Add to Google Calendar</a></p>
            ${directCalendarEvent?.htmlLink ? `<p><a href="${directCalendarEvent.htmlLink}" target="_blank" rel="noreferrer" style="color:#e21b23;">Open saved calendar event</a></p>` : ''}
            <p><strong>${appointment.name}</strong><br>${appointment.email}<br>${appointment.phone}</p>
            <p><strong>Service:</strong> ${appointment.service}<br><strong>Date:</strong> ${appointment.preferredDate || '-'}</p>
          </main>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Appointment action failed:', error);
    return res.status(500).send('Could not update appointment.');
  }
});

app.post('/api/appointments/:id/deny', async (req, res) => {
  try {
    const { id } = req.params;
    const { token, suggestedDate, suggestedTime, ownerMessage, action } = req.body || {};
    const appointments = await readAppointments();
    const appointment = appointments.find((item) => item.id === id);

    if (!appointment || appointment.token !== token) {
      return res.status(404).send('Appointment action link is invalid.');
    }

    if (!['pending', 'customer_reschedule_requested'].includes(appointment.status)) {
      return res.send(`
        <html><body style="font-family: Arial, sans-serif; padding: 40px;">
          <h1>Already handled</h1>
          <p>This appointment is already marked as <strong>${escapeHtml(appointment.status)}</strong>.</p>
        </body></html>
      `);
    }

    const transporter = createTransporter();

    if (!transporter) {
      return res.status(503).send('Appointment not updated. Email sending is not configured.');
    }

    const hasAlternative = action === 'suggest';
    const customerToken = appointment.customerToken || crypto.randomBytes(24).toString('hex');
    appointment.customerToken = customerToken;
    appointment.status = hasAlternative ? 'alternative_sent' : 'denied';
    appointment.suggestedDate = hasAlternative ? suggestedDate || '' : '';
    appointment.suggestedTime = hasAlternative ? suggestedTime || '' : '';
    appointment.ownerMessage = ownerMessage || '';
    appointment.updatedAt = new Date().toISOString();
    await writeAppointments(appointments);

    const baseUrl = getBaseUrl();
    const acceptUrl = hasAlternative ? `${baseUrl}/api/appointments/${appointment.id}/alternative/accept?token=${appointment.customerToken}` : '';
    const rescheduleUrl = hasAlternative ? `${baseUrl}/api/appointments/${appointment.id}/reschedule?token=${appointment.customerToken}` : '';
    const alternativeButtons = [
      { label: 'Accept suggested time', url: acceptUrl, color: '#16a34a' },
      { label: 'Request another time', url: rescheduleUrl, color: '#e21b23' },
    ];

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: appointment.email,
      replyTo: companyEmail,
      subject: hasAlternative ? 'Prestige Auto Detailing - alternative appointment time' : 'Prestige Auto Detailing appointment time update',
      ...(hasAlternative
        ? {
            html: emailShell(
              'Alternative Appointment Time',
              `Hello ${appointment.name},\n\nYour requested appointment time for ${appointment.service} could not be confirmed. We can offer this alternative time instead.`,
              [
                `<strong>Suggested date:</strong> ${escapeHtml(suggestedDate || '-')}`,
                `<strong>Suggested time:</strong> ${escapeHtml(suggestedTime || '-')}`,
                `<strong>Message:</strong><br>${escapeHtml(ownerMessage || 'Please contact us to choose another available time.').replaceAll('\n', '<br>')}`,
              ].join('<br>'),
              alternativeButtons,
            ),
          }
        : { text: customerDecisionText('denied', appointment) }),
    });

    return res.send(`
      <html>
        <body style="background:#050505;color:#f5f5f3;font-family:Arial,sans-serif;padding:40px;">
          <main style="max-width:640px;margin:auto;border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:28px;background:#111;">
            <h1 style="color:#e21b23;margin-top:0;">${hasAlternative ? 'Alternative time sent' : 'Appointment denied'}</h1>
            <p>The customer has been emailed.</p>
            <p><strong>${escapeHtml(appointment.name)}</strong><br>${escapeHtml(appointment.email)}<br>${escapeHtml(appointment.phone)}</p>
            ${
              hasAlternative
                ? `<p><strong>Suggested date:</strong> ${escapeHtml(suggestedDate || '-')}<br><strong>Suggested time:</strong> ${escapeHtml(suggestedTime || '-')}</p>`
                : ''
            }
          </main>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Appointment denial failed:', error);
    return res.status(500).send('Could not update appointment.');
  }
});

app.get('/api/appointments/:id/alternative/accept', async (req, res) => {
  try {
    const { id } = req.params;
    const { token } = req.query;
    const appointments = await readAppointments();
    const appointment = appointments.find((item) => item.id === id);

    if (!appointment || appointment.customerToken !== token) {
      return res.status(404).send('Appointment link is invalid.');
    }

    if (appointment.status !== 'alternative_sent' || !appointment.suggestedDate || !appointment.suggestedTime) {
      return res.send(`
        <html><body style="font-family: Arial, sans-serif; padding: 40px;">
          <h1>Cannot accept this time</h1>
          <p>This appointment is currently marked as <strong>${escapeHtml(appointment.status)}</strong>.</p>
        </body></html>
      `);
    }

    const availability = await isCalendarSlotAvailable(appointment.suggestedDate, appointment.suggestedTime, appointment.durationMinutes);

    if (!availability.available) {
      return res.status(409).send(`
        <html>
          <body style="background:#050505;color:#f5f5f3;font-family:Arial,sans-serif;padding:40px;">
            <main style="max-width:640px;margin:auto;border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:28px;background:#111;">
              <h1 style="color:#e21b23;margin-top:0;">That time is no longer available</h1>
              <p>Please request another appointment time.</p>
              <p><a href="/api/appointments/${appointment.id}/reschedule?token=${escapeHtml(token)}" style="color:#e21b23;">Request another time</a></p>
            </main>
          </body>
        </html>
      `);
    }

    appointment.previousRequestedDate = appointment.preferredDate || '';
    appointment.previousRequestedTime = appointment.preferredTime || '';
    appointment.preferredDate = appointment.suggestedDate;
    appointment.preferredTime = appointment.suggestedTime;
    appointment.status = 'confirmed';
    appointment.updatedAt = new Date().toISOString();

    let directCalendarEvent = null;
    let directCalendarError = null;

    try {
      directCalendarEvent = await createOwnerCalendarEventDirectly(appointment);
      if (directCalendarEvent?.id) {
        appointment.calendarEventId = directCalendarEvent.id;
        appointment.calendarEventLink = directCalendarEvent.htmlLink || '';
      }
    } catch (error) {
      directCalendarError = error;
      console.error('Direct Google Calendar event creation failed:', error);
    }

    await writeAppointments(appointments);

    const transporter = createTransporter();

    if (transporter) {
      await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: appointment.email,
        replyTo: companyEmail,
        subject: 'Your Prestige Auto Detailing appointment is confirmed',
        text: customerDecisionText('confirmed', appointment),
      });

      await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: companyEmail,
        subject: `Customer accepted alternative time: ${appointment.name}`,
        text: [
          'The customer accepted the alternative appointment time.',
          '',
          directCalendarEvent
            ? 'The appointment was automatically added to the owner Google Calendar.'
            : 'Automatic Google Calendar saving is not configured or failed.',
          directCalendarError ? `Calendar API error: ${directCalendarError.message || directCalendarError}` : '',
          '',
          `Customer: ${appointment.name}`,
          `Phone: ${appointment.phone}`,
          `Service: ${appointment.service}`,
          `Date: ${appointment.preferredDate}`,
          `Time: ${appointment.preferredTime}`,
        ].filter(Boolean).join('\n'),
      });
    }

    return res.send(`
      <html>
        <body style="background:#050505;color:#f5f5f3;font-family:Arial,sans-serif;padding:40px;">
          <main style="max-width:640px;margin:auto;border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:28px;background:#111;">
            <h1 style="color:#e21b23;margin-top:0;">Appointment confirmed</h1>
            <p>Your appointment has been confirmed for <strong>${escapeHtml(appointment.preferredDate)}</strong> at <strong>${escapeHtml(appointment.preferredTime)}</strong>.</p>
            <p>Prestige Auto Detailing has been notified.</p>
          </main>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Alternative accept failed:', error);
    return res.status(500).send('Could not confirm appointment.');
  }
});

app.get('/api/appointments/:id/reschedule', async (req, res) => {
  try {
    const { id } = req.params;
    const { token } = req.query;
    const appointments = await readAppointments();
    const appointment = appointments.find((item) => item.id === id);

    if (!appointment || appointment.customerToken !== token) {
      return res.status(404).send('Appointment link is invalid.');
    }

    if (!['alternative_sent', 'customer_reschedule_requested'].includes(appointment.status)) {
      return res.send(`
        <html><body style="font-family: Arial, sans-serif; padding: 40px;">
          <h1>Cannot request another time</h1>
          <p>This appointment is currently marked as <strong>${escapeHtml(appointment.status)}</strong>.</p>
        </body></html>
      `);
    }

    return res.send(customerReschedulePage(appointment, token));
  } catch (error) {
    console.error('Customer reschedule page failed:', error);
    return res.status(500).send('Could not open reschedule page.');
  }
});

app.post('/api/appointments/:id/reschedule', async (req, res) => {
  try {
    const { id } = req.params;
    const { token, preferredDate, preferredTime, customerMessage } = req.body || {};
    const appointments = await readAppointments();
    const appointment = appointments.find((item) => item.id === id);

    if (!appointment || appointment.customerToken !== token) {
      return res.status(404).send('Appointment link is invalid.');
    }

    if (!required(preferredDate) || !required(preferredTime)) {
      return res.status(400).send('Preferred date and time are required.');
    }

    const availability = await isCalendarSlotAvailable(preferredDate, preferredTime, appointment.durationMinutes);

    if (!availability.available) {
      return res.status(409).send(`
        <html>
          <body style="background:#050505;color:#f5f5f3;font-family:Arial,sans-serif;padding:40px;">
            <main style="max-width:640px;margin:auto;border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:28px;background:#111;">
              <h1 style="color:#e21b23;margin-top:0;">That time is already booked</h1>
              <p>Please go back and choose another date and time.</p>
            </main>
          </body>
        </html>
      `);
    }

    appointment.rescheduleHistory = Array.isArray(appointment.rescheduleHistory) ? appointment.rescheduleHistory : [];
    appointment.rescheduleHistory.push({
      at: new Date().toISOString(),
      fromDate: appointment.preferredDate || '',
      fromTime: appointment.preferredTime || '',
      suggestedDate: appointment.suggestedDate || '',
      suggestedTime: appointment.suggestedTime || '',
      requestedDate: preferredDate,
      requestedTime: preferredTime,
      customerMessage: customerMessage || '',
    });
    appointment.preferredDate = preferredDate;
    appointment.preferredTime = preferredTime;
    appointment.customerMessage = customerMessage || '';
    appointment.status = 'customer_reschedule_requested';
    appointment.updatedAt = new Date().toISOString();
    await writeAppointments(appointments);

    const transporter = createTransporter();

    if (!transporter) {
      return res.status(503).send('Request saved, but email sending is not configured.');
    }

    const baseUrl = getBaseUrl();
    const confirmUrl = `${baseUrl}/api/appointments/${appointment.id}/confirm?token=${appointment.token}`;
    const denyUrl = `${baseUrl}/api/appointments/${appointment.id}/deny?token=${appointment.token}`;
    const buttons = [
      { label: 'Confirm requested time', url: confirmUrl, color: '#16a34a' },
      { label: 'Deny or suggest new time', url: denyUrl, color: '#e21b23' },
    ];

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: companyEmail,
      replyTo: appointment.email,
      subject: 'Prestige Auto Detailing - customer requested another time',
      html: emailShell(
        'Customer Requested Another Time',
        'The customer cannot use the suggested time and sent a new preferred date and time.',
        [
          `<strong>Customer:</strong> ${escapeHtml(appointment.name)}`,
          `<strong>Email:</strong> ${escapeHtml(appointment.email)}`,
          `<strong>Phone:</strong> ${escapeHtml(appointment.phone)}`,
          `<strong>Vehicle:</strong> ${escapeHtml([appointment.vehicleMake, appointment.vehicleModel].filter(Boolean).join(' ') || '-')}`,
          `<strong>Service:</strong> ${escapeHtml(appointment.service)}`,
          `<strong>Duration:</strong> ${escapeHtml(normalizeDurationMinutes(appointment.durationMinutes))} minutes`,
          `<strong>Requested date:</strong> ${escapeHtml(appointment.preferredDate || '-')}`,
          `<strong>Requested time:</strong> ${escapeHtml(appointment.preferredTime || '-')}`,
          `<strong>Customer message:</strong><br>${escapeHtml(appointment.customerMessage || '-').replaceAll('\n', '<br>')}`,
        ].join('<br>'),
        buttons,
      ),
    });

    return res.send(`
      <html>
        <body style="background:#050505;color:#f5f5f3;font-family:Arial,sans-serif;padding:40px;">
          <main style="max-width:640px;margin:auto;border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:28px;background:#111;">
            <h1 style="color:#e21b23;margin-top:0;">New time sent</h1>
            <p>Your new requested time was sent to Prestige Auto Detailing.</p>
            <p><strong>Date:</strong> ${escapeHtml(preferredDate)}<br><strong>Time:</strong> ${escapeHtml(preferredTime)}</p>
            <p>The owner will confirm this time or suggest another option.</p>
          </main>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Customer reschedule failed:', error);
    return res.status(500).send('Could not send new requested time.');
  }
});

app.use(express.static(distPath));

app.use((_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`Prestige backend running on http://localhost:${port}`);
});
