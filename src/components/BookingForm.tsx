import { useState, type FocusEvent, type FormEvent } from 'react';
import { useLanguage } from '../i18n';
import { Button } from './Button';

const fieldNames = ['name', 'email', 'phone', 'vehicleMake', 'vehicleModel'] as const;
const fieldTypes = ['text', 'email', 'tel', 'text', 'text'];

export function BookingForm() {
  const { content, language } = useLanguage();
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [availability, setAvailability] = useState<'idle' | 'checking' | 'available' | 'booked' | 'error'>('idle');

  const getSelectedService = (form: HTMLFormElement) => {
    const data = new FormData(form);
    return content.services.find((service) => service.title === data.get('service')) || content.services[0];
  };

  const checkAvailability = async (preferredDate: FormDataEntryValue | null, preferredTime: FormDataEntryValue | null, durationMinutes?: number) => {
    if (!preferredDate || !preferredTime) {
      setAvailability('idle');
      return true;
    }

    setAvailability('checking');
    const response = await fetch('/api/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferredDate, preferredTime, durationMinutes }),
    });
    const result = (await response.json().catch(() => ({}))) as { available?: boolean; message?: string };

    if (!response.ok) {
      setAvailability('error');
      setStatus('error');
      setStatusMessage(result.message || 'Could not check availability.');
      return false;
    }

    if (result.available) {
      setAvailability('available');
      if (status !== 'sending') {
        setStatusMessage('');
      }
      return true;
    }

    setAvailability('booked');
    setStatus('error');
    setStatusMessage(result.message || 'That date and time is already booked.');
    return false;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('sending');
    setStatusMessage('');

    const form = event.currentTarget;
    const data = new FormData(form);
    const selectedService = getSelectedService(form);
    const isAvailable = await checkAvailability(data.get('preferredDate'), data.get('preferredTime'), selectedService.durationMinutes);

    if (!isAvailable) {
      setStatus('error');
      return;
    }

    const payload = {
      language,
      name: data.get('name'),
      email: data.get('email'),
      phone: data.get('phone'),
      vehicleMake: data.get('vehicleMake'),
      vehicleModel: data.get('vehicleModel'),
      service: data.get('service'),
      durationMinutes: selectedService.durationMinutes,
      preferredDate: data.get('preferredDate'),
      preferredTime: data.get('preferredTime'),
      message: data.get('message'),
    };

    try {
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        if (response.status === 409) {
          setAvailability('booked');
        }
        throw new Error(result.message || 'Could not send appointment request.');
      }

      setStatus('sent');
      setAvailability('idle');
      setStatusMessage(result.message || 'Appointment request sent.');
      form.reset();
    } catch (error) {
      setStatus('error');
      setStatusMessage(error instanceof Error ? error.message : 'Could not send appointment request.');
    }
  };

  const handleDateTimeBlur = (event: FocusEvent<HTMLFormElement>) => {
    const target = event.target as unknown as HTMLInputElement;

    if (target.name !== 'preferredDate' && target.name !== 'preferredTime') {
      return;
    }

    const data = new FormData(event.currentTarget);
    const selectedService = getSelectedService(event.currentTarget);
    void checkAvailability(data.get('preferredDate'), data.get('preferredTime'), selectedService.durationMinutes);
  };

  return (
    <form onSubmit={handleSubmit} onBlur={handleDateTimeBlur} className="glass grid gap-4 rounded-lg p-5 md:grid-cols-2 md:p-8">
      {content.form.fields.map((label, index) => (
        <label key={label} className="grid gap-2 text-sm font-semibold text-white">
          {label}
          <input
            name={fieldNames[index]}
            type={fieldTypes[index]}
            required={index < 3}
            className="rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-platinum outline-none transition focus:border-gold"
            placeholder={label}
          />
        </label>
      ))}
      <label className="grid gap-2 text-sm font-semibold text-white">
        {content.form.service}
        <select name="service" required className="rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-platinum outline-none transition focus:border-gold">
          {content.services.map((service) => (
            <option key={service.title} value={service.title}>
              {service.title}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-semibold text-white">
        {content.form.date}
        <input name="preferredDate" type="date" required className="rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-platinum outline-none transition focus:border-gold" />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-white">
        {content.form.time}
        <input name="preferredTime" type="time" required className="rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-platinum outline-none transition focus:border-gold" />
      </label>
      {availability !== 'idle' && (
        <p
          className={`rounded-lg border px-4 py-3 text-sm md:col-span-2 ${
            availability === 'available'
              ? 'border-green-400/30 bg-green-400/10 text-green-100'
              : availability === 'checking'
                ? 'border-white/20 bg-white/10 text-platinum'
                : 'border-red-400/30 bg-red-400/10 text-red-100'
          }`}
        >
          {availability === 'checking' && 'Checking availability...'}
          {availability === 'available' && 'This date and time is available.'}
          {availability === 'booked' && 'That date and time is already booked.'}
          {availability === 'error' && 'Could not check availability.'}
        </p>
      )}
      <label className="grid gap-2 text-sm font-semibold text-white md:col-span-2">
        {content.form.message}
        <textarea name="message" rows={5} className="rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-platinum outline-none transition focus:border-gold" />
      </label>
      {statusMessage && (
        <p className={`rounded-lg border px-4 py-3 text-sm md:col-span-2 ${status === 'sent' ? 'border-green-400/30 bg-green-400/10 text-green-100' : 'border-red-400/30 bg-red-400/10 text-red-100'}`}>
          {statusMessage}
        </p>
      )}
      <div className="md:col-span-2">
        <Button>{status === 'sending' ? 'Sending...' : content.form.submit}</Button>
      </div>
    </form>
  );
}
