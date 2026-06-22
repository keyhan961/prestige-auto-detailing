import { Clock, Facebook, Instagram, Mail, MapPin, Phone } from 'lucide-react';
import { BookingForm } from '../components/BookingForm';
import { SEO } from '../components/SEO';
import { SectionHeading } from '../components/SectionHeading';
import { TikTokIcon } from '../components/TikTokIcon';
import { contactDetails, socialLinks } from '../data/site';
import { useLanguage } from '../i18n';

export function Contact() {
  const { content, language } = useLanguage();
  const page = content.pages.contact;
  const businessHours = {
    en: 'Mon-Sun 8:00 AM - 6:00 PM',
    fi: 'Ma-Su 8:00 - 18:00',
    ru: 'Пн-Вс 8:00 - 18:00',
  }[language];
  const contactItems = [
    { icon: Phone, label: page.phone, value: contactDetails.phone[language] },
    { icon: Mail, label: page.email, value: contactDetails.email },
    { icon: MapPin, label: page.studio, value: contactDetails.studio },
    { icon: Clock, label: page.hours, value: businessHours },
  ];

  return (
    <>
      <SEO title={page.seoTitle} description={page.seoDescription} />
      <section className="section-pad bg-obsidian pt-32">
        <SectionHeading eyebrow={page.eyebrow} title={page.title} copy={page.copy} />
        <div className="mx-auto grid min-w-0 max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="grid min-w-0 gap-4">
            {contactItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="min-w-0 rounded-lg border border-white/10 bg-white/[0.035] p-5">
                  <Icon className="text-gold" />
                  <p className="mt-4 text-xs font-bold uppercase tracking-[0.25em] text-platinum/50">{item.label}</p>
                  <p className="mt-1 break-words font-semibold text-white">{item.value}</p>
                </div>
              );
            })}
            <div className="rounded-lg border border-white/10 bg-luxury p-5">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">{page.social}</p>
              <div className="mt-4 flex gap-4 text-platinum">
                <a href={socialLinks.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className="transition hover:text-gold">
                  <Instagram />
                </a>
                <a href={socialLinks.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" className="transition hover:text-gold">
                  <Facebook />
                </a>
                <a href={socialLinks.tiktok} target="_blank" rel="noreferrer" aria-label="TikTok" className="transition hover:text-gold">
                  <TikTokIcon />
                </a>
              </div>
            </div>
          </aside>
          <div id="booking" className="min-w-0">
            <BookingForm />
          </div>
        </div>
      </section>
      <section className="section-pad bg-charcoal">
        <SectionHeading eyebrow={page.visitEyebrow} title={page.visitTitle} copy={page.visitCopy} />
        <div className="mx-auto max-w-7xl overflow-hidden rounded-lg border border-white/10 bg-black shadow-glow">
          <iframe
            title={page.studioTitle}
            src={`https://www.google.com/maps?q=${encodeURIComponent(contactDetails.studio)}&output=embed`}
            className="h-[300px] w-full border-0 sm:h-[360px] md:h-[420px]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="flex flex-col gap-4 border-t border-white/10 bg-charcoal p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xl font-bold text-white">
                <MapPin className="text-gold" size={22} />
                {page.studioTitle}
              </p>
              <p className="mt-1 text-platinum/70">{contactDetails.studio}</p>
            </div>
            <a
              href={contactDetails.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-gold/40 px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-gold transition hover:bg-gold hover:text-white"
            >
              {page.mapCopy}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
