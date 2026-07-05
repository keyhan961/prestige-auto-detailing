import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarClock, CalendarPlus, CheckCircle2, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '../components/Button';
import { SEO } from '../components/SEO';
import { SectionHeading } from '../components/SectionHeading';
import { useLanguage } from '../i18n';

type OwnerAppointment = {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string;
  name: string;
  email: string;
  phone: string;
  vehicleMake: string;
  vehicleModel: string;
  service: string;
  durationMinutes: number;
  preferredDate: string;
  preferredTime: string;
  message: string;
  suggestedDate: string;
  suggestedTime: string;
  ownerMessage: string;
  source: string;
  calendarEventLink: string;
  calendarError: string;
};

type ApiMessage = {
  message?: string;
  mailMessage?: string;
  configured?: boolean;
  deviceLockEnabled?: boolean;
  deviceTrusted?: boolean;
  authenticated?: boolean;
  appointments?: OwnerAppointment[];
  calendarMessage?: string;
};

const ownerFields = [
  ['name', 'Customer name', 'text', true],
  ['phone', 'Phone', 'tel', true],
  ['email', 'Email', 'email', false],
  ['vehicleMake', 'Vehicle make', 'text', false],
  ['vehicleModel', 'Vehicle model', 'text', false],
] as const;

function appointmentTimeValue(appointment: OwnerAppointment) {
  return `${appointment.preferredDate || '9999-12-31'}T${appointment.preferredTime || '23:59'}`;
}

function displayStatus(status: string) {
  if (status === 'completed') {
    return 'completed';
  }
  if (status === 'ongoing' || status === 'confirmed') {
    return 'ongoing';
  }
  if (status === 'denied') {
    return 'denied';
  }
  return 'pending';
}

function statusClass(status: string) {
  const label = displayStatus(status);
  if (label === 'ongoing') {
    return 'border-green-400/30 bg-green-400/10 text-green-100';
  }
  if (label === 'completed') {
    return 'border-blue-400/30 bg-blue-400/10 text-blue-100';
  }
  if (label === 'pending') {
    return 'border-yellow-400/30 bg-yellow-400/10 text-yellow-100';
  }
  return 'border-red-400/30 bg-red-400/10 text-red-100';
}

export function OwnerDashboard() {
  const { content } = useLanguage();
  const [configured, setConfigured] = useState(true);
  const [deviceLockEnabled, setDeviceLockEnabled] = useState(false);
  const [deviceTrusted, setDeviceTrusted] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [appointments, setAppointments] = useState<OwnerAppointment[]>([]);
  const [password, setPassword] = useState('');
  const [deviceCode, setDeviceCode] = useState('');
  const [deviceLabel, setDeviceLabel] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState('');
  const [rescheduleId, setRescheduleId] = useState('');
  const [selectedService, setSelectedService] = useState(content.services[0]?.title || '');

  const selectedServiceData = content.services.find((service) => service.title === selectedService) || content.services[0];

  const loadSession = async () => {
    const response = await fetch('/api/admin/session', { credentials: 'include' });
    const result = (await response.json().catch(() => ({}))) as ApiMessage;
    setConfigured(Boolean(result.configured));
    setDeviceLockEnabled(Boolean(result.deviceLockEnabled));
    setDeviceTrusted(result.deviceLockEnabled ? Boolean(result.deviceTrusted) : true);
    setAuthenticated(Boolean(result.authenticated));
    setLoading(false);
    if (result.authenticated) {
      await loadAppointments();
    }
  };

  const loadAppointments = async () => {
    const response = await fetch('/api/admin/appointments', { credentials: 'include' });
    const result = (await response.json().catch(() => ({}))) as ApiMessage;
    if (!response.ok) {
      setStatusMessage(result.message || 'Could not load appointments.');
      return;
    }
    setAppointments(result.appointments || []);
  };

  useEffect(() => {
    void loadSession();
  }, []);

  const groups = useMemo(() => {
    const sorted = [...appointments].sort((a, b) => appointmentTimeValue(a).localeCompare(appointmentTimeValue(b)));
    const isPrevious = (appointment: OwnerAppointment) => ['completed', 'denied'].includes(displayStatus(appointment.status));
    return {
      current: sorted.filter((item) => !isPrevious(item)),
      previous: sorted.filter(isPrevious).reverse(),
    };
  }, [appointments]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage('');
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const result = (await response.json().catch(() => ({}))) as ApiMessage;
    if (!response.ok) {
      setStatusMessage(result.message || 'Login failed.');
      return;
    }
    setPassword('');
    setAuthenticated(true);
    await loadAppointments();
  };

  const handleTrustDevice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage('');
    const response = await fetch('/api/admin/device/trust', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: deviceCode,
        label: deviceLabel || navigator.userAgent.slice(0, 80),
      }),
    });
    const result = (await response.json().catch(() => ({}))) as ApiMessage;
    if (!response.ok) {
      setStatusMessage(result.message || 'Device could not be trusted.');
      return;
    }
    setDeviceCode('');
    setDeviceTrusted(true);
    setStatusMessage(result.message || 'This device is now trusted.');
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
    setAuthenticated(false);
    setAppointments([]);
  };

  const handleManualAppointment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage('');
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: data.get('name'),
      phone: data.get('phone'),
      email: data.get('email'),
      vehicleMake: data.get('vehicleMake'),
      vehicleModel: data.get('vehicleModel'),
      service: data.get('service'),
      durationMinutes: selectedServiceData?.durationMinutes || 120,
      preferredDate: data.get('preferredDate'),
      preferredTime: data.get('preferredTime'),
      message: data.get('message'),
    };
    const response = await fetch('/api/admin/appointments', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = (await response.json().catch(() => ({}))) as ApiMessage;
    if (!response.ok) {
      setStatusMessage(result.message || 'Could not add appointment.');
      return;
    }
    setStatusMessage(`${result.message || 'Appointment added.'} ${result.calendarMessage || ''}`.trim());
    form.reset();
    setSelectedService(content.services[0]?.title || '');
    await loadAppointments();
  };

  const handleConfirmAppointment = async (appointment: OwnerAppointment) => {
    setStatusMessage('');
    setActionId(appointment.id);
    const response = await fetch(`/api/admin/appointments/${appointment.id}/confirm`, {
      method: 'POST',
      credentials: 'include',
    });
    const result = (await response.json().catch(() => ({}))) as ApiMessage;
    setActionId('');
    if (!response.ok) {
      setStatusMessage(result.message || 'Could not confirm appointment.');
      return;
    }
    setStatusMessage([result.message, result.calendarMessage, result.mailMessage].filter(Boolean).join(' '));
    await loadAppointments();
  };

  const handleSuggestReschedule = async (event: FormEvent<HTMLFormElement>, appointment: OwnerAppointment) => {
    event.preventDefault();
    setStatusMessage('');
    setActionId(appointment.id);
    const data = new FormData(event.currentTarget);
    const payload = {
      suggestedDate: data.get('suggestedDate'),
      suggestedTime: data.get('suggestedTime'),
      ownerMessage: data.get('ownerMessage'),
    };
    const response = await fetch(`/api/admin/appointments/${appointment.id}/reschedule`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = (await response.json().catch(() => ({}))) as ApiMessage;
    setActionId('');
    if (!response.ok) {
      setStatusMessage(result.message || 'Could not send reschedule suggestion.');
      return;
    }
    setRescheduleId('');
    setStatusMessage([result.message, result.mailMessage].filter(Boolean).join(' '));
    await loadAppointments();
  };

  const handleMarkDone = async (appointment: OwnerAppointment) => {
    setStatusMessage('');
    setActionId(appointment.id);
    const response = await fetch(`/api/admin/appointments/${appointment.id}/complete`, {
      method: 'POST',
      credentials: 'include',
    });
    const result = (await response.json().catch(() => ({}))) as ApiMessage;
    setActionId('');
    if (!response.ok) {
      setStatusMessage(result.message || 'Could not mark appointment done.');
      return;
    }
    setStatusMessage(result.message || 'Appointment marked done.');
    await loadAppointments();
  };

  const renderAppointment = (appointment: OwnerAppointment) => (
    <article key={appointment.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-lg font-bold text-white">{appointment.name}</p>
          <p className="text-sm text-platinum/65">
            {appointment.preferredDate} at {appointment.preferredTime} · {appointment.service}
          </p>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${statusClass(appointment.status)}`}>{displayStatus(appointment.status)}</span>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-platinum/70 sm:grid-cols-2">
        <p>Phone: {appointment.phone || '-'}</p>
        <p>Email: {appointment.email || '-'}</p>
        <p>Vehicle: {[appointment.vehicleMake, appointment.vehicleModel].filter(Boolean).join(' ') || '-'}</p>
        <p>Duration: {appointment.durationMinutes} min</p>
        <p>Source: {appointment.source}</p>
        {appointment.completedAt && <p>Completed: {new Date(appointment.completedAt).toLocaleString()}</p>}
        {appointment.calendarEventLink && (
          <a href={appointment.calendarEventLink} target="_blank" rel="noreferrer" className="text-gold hover:text-red-300">
            Open calendar event
          </a>
        )}
      </div>
      {displayStatus(appointment.status) === 'pending' && (
        <button
          type="button"
          onClick={() => void handleConfirmAppointment(appointment)}
          disabled={actionId === appointment.id}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] text-yellow-100 transition hover:border-yellow-300 hover:bg-yellow-400/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CheckCircle2 size={16} /> {actionId === appointment.id ? 'Saving...' : 'Confirm booking'}
        </button>
      )}
      {displayStatus(appointment.status) === 'pending' && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setRescheduleId(rescheduleId === appointment.id ? '' : appointment.id)}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] text-platinum transition hover:border-gold hover:text-gold"
          >
            <CalendarClock size={16} /> Suggest new time
          </button>
          {rescheduleId === appointment.id && (
            <form onSubmit={(event) => void handleSuggestReschedule(event, appointment)} className="mt-4 grid gap-4 rounded-lg border border-white/10 bg-black/25 p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-white">
                  New date
                  <input name="suggestedDate" type="date" required className="rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-platinum outline-none transition focus:border-gold" />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-white">
                  New time
                  <input name="suggestedTime" type="time" required className="rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-platinum outline-none transition focus:border-gold" />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-semibold text-white">
                Message to customer
                <textarea
                  name="ownerMessage"
                  rows={3}
                  defaultValue="The requested time is not available. We can offer this alternative appointment time."
                  className="rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-platinum outline-none transition focus:border-gold"
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={actionId === appointment.id}
                  className="inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-500/15 px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] text-red-100 transition hover:border-red-300 hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {actionId === appointment.id ? 'Sending...' : 'Send new time'}
                </button>
                <button type="button" onClick={() => setRescheduleId('')} className="rounded-full border border-white/15 px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] text-platinum transition hover:border-white/30">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
      {appointment.suggestedDate && (
        <p className="mt-4 rounded-lg border border-yellow-400/20 bg-yellow-400/10 p-3 text-sm text-yellow-100">
          Suggested: {appointment.suggestedDate} at {appointment.suggestedTime}
        </p>
      )}
      {displayStatus(appointment.status) === 'ongoing' && (
        <button
          type="button"
          onClick={() => void handleMarkDone(appointment)}
          disabled={actionId === appointment.id}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-green-400/30 bg-green-400/10 px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] text-green-100 transition hover:border-green-300 hover:bg-green-400/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CheckCircle2 size={16} /> {actionId === appointment.id ? 'Saving...' : 'Mark done'}
        </button>
      )}
      {appointment.message && <p className="mt-4 rounded-lg bg-black/30 p-3 text-sm text-platinum/70">{appointment.message}</p>}
      {appointment.calendarError && <p className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100">{appointment.calendarError}</p>}
    </article>
  );

  return (
    <>
      <SEO title="Owner Dashboard | Prestige Auto Detailing" description="Private owner booking dashboard." noIndex />
      <section className="section-pad bg-obsidian pt-32">
        <SectionHeading eyebrow="Owner" title="Booking Dashboard" copy="Manage website bookings, review previous appointments, and add manual appointments for customers who book outside the website." />

        {loading && <p className="mx-auto max-w-5xl text-platinum/70">Loading owner dashboard...</p>}

        {!loading && !configured && (
          <div className="glass mx-auto max-w-2xl rounded-lg p-6">
            <ShieldCheck className="text-gold" />
            <h2 className="mt-4 text-2xl font-bold text-white">Owner dashboard is not configured</h2>
            <p className="mt-2 text-platinum/70">Add an owner dashboard password in <code>public_html/api/config.php</code> before using this page.</p>
          </div>
        )}

        {!loading && configured && deviceLockEnabled && !deviceTrusted && (
          <form onSubmit={handleTrustDevice} className="glass mx-auto grid max-w-md gap-4 rounded-lg p-6">
            <ShieldCheck className="text-gold" />
            <div>
              <h2 className="text-2xl font-bold text-white">Trusted device required</h2>
              <p className="mt-2 text-sm text-platinum/70">This owner dashboard can only be opened from approved devices. Enter the device access code once on this device.</p>
            </div>
            <label className="grid gap-2 text-sm font-semibold text-white">
              Device access code
              <input value={deviceCode} onChange={(event) => setDeviceCode(event.target.value)} type="password" required className="rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-platinum outline-none transition focus:border-gold" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-white">
              Device name
              <input value={deviceLabel} onChange={(event) => setDeviceLabel(event.target.value)} type="text" placeholder="Owner phone, studio laptop..." className="rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-platinum outline-none transition focus:border-gold" />
            </label>
            {statusMessage && <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">{statusMessage}</p>}
            <Button>Trust This Device</Button>
          </form>
        )}

        {!loading && configured && (!deviceLockEnabled || deviceTrusted) && !authenticated && (
          <form onSubmit={handleLogin} className="glass mx-auto grid max-w-md gap-4 rounded-lg p-6">
            <ShieldCheck className="text-gold" />
            <label className="grid gap-2 text-sm font-semibold text-white">
              Owner password
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required className="rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-platinum outline-none transition focus:border-gold" />
            </label>
            {statusMessage && <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">{statusMessage}</p>}
            <Button>Log In</Button>
          </form>
        )}

        {!loading && authenticated && (
          <div className="mx-auto grid max-w-7xl gap-8 xl:grid-cols-[0.85fr_1.15fr]">
            <aside className="glass h-fit rounded-lg p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-gold">Manual booking</p>
                  <h2 className="mt-2 text-2xl font-bold text-white">Add Appointment</h2>
                </div>
                <CalendarPlus className="text-gold" />
              </div>
              <form onSubmit={handleManualAppointment} className="mt-5 grid gap-4">
                {ownerFields.map(([name, label, type, required]) => (
                  <label key={name} className="grid gap-2 text-sm font-semibold text-white">
                    {label}
                    <input name={name} type={type} required={required} className="rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-platinum outline-none transition focus:border-gold" />
                  </label>
                ))}
                <label className="grid gap-2 text-sm font-semibold text-white">
                  Service
                  <select name="service" required value={selectedService} onChange={(event) => setSelectedService(event.target.value)} className="rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-platinum outline-none transition focus:border-gold">
                    {content.services.map((service) => (
                      <option key={service.title} value={service.title}>
                        {service.title} · {service.duration}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-semibold text-white">
                    Date
                    <input name="preferredDate" type="date" required className="rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-platinum outline-none transition focus:border-gold" />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-white">
                    Time
                    <input name="preferredTime" type="time" required className="rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-platinum outline-none transition focus:border-gold" />
                  </label>
                </div>
                <label className="grid gap-2 text-sm font-semibold text-white">
                  Notes
                  <textarea name="message" rows={4} className="rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-platinum outline-none transition focus:border-gold" />
                </label>
                {statusMessage && <p className="rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-sm text-platinum">{statusMessage}</p>}
                <Button>Add Appointment</Button>
              </form>
            </aside>

            <div className="grid gap-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-gold">Appointments</p>
                  <h2 className="mt-2 text-2xl font-bold text-white">Current and Previous</h2>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => void loadAppointments()} className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] text-white transition hover:border-gold hover:text-gold">
                    <RefreshCw size={16} /> Refresh
                  </button>
                  <button onClick={() => void handleLogout()} className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] text-white transition hover:border-gold hover:text-gold">
                    <LogOut size={16} /> Log Out
                  </button>
                </div>
              </div>

              <section className="grid gap-4">
                <h3 className="text-lg font-bold text-white">Current bookings ({groups.current.length})</h3>
                {groups.current.length ? groups.current.map(renderAppointment) : <p className="rounded-lg border border-white/10 p-5 text-platinum/60">No current bookings.</p>}
              </section>

              <section className="grid gap-4">
                <h3 className="text-lg font-bold text-white">Previous bookings ({groups.previous.length})</h3>
                {groups.previous.length ? groups.previous.map(renderAppointment) : <p className="rounded-lg border border-white/10 p-5 text-platinum/60">No previous bookings.</p>}
              </section>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
