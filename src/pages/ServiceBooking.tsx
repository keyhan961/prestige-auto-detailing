import { Navigate, useParams } from 'react-router-dom';
import { BookingForm } from '../components/BookingForm';
import { Button } from '../components/Button';
import { SEO } from '../components/SEO';
import { SectionHeading } from '../components/SectionHeading';
import { serviceStructuredData } from '../data/seo';
import { useLanguage } from '../i18n';
import { serviceIndexFromSlug } from '../utils/serviceRoutes';

export function ServiceBooking() {
  const { serviceSlug } = useParams();
  const { content } = useLanguage();
  const page = content.pages.services;
  const serviceIndex = serviceIndexFromSlug(serviceSlug);

  if (serviceIndex < 0) {
    return <Navigate to="/services" replace />;
  }

  const service = content.services[serviceIndex];
  const Icon = service.icon;

  return (
    <>
      <SEO title={`${service.title} in Espoo | Prestige Auto Detailing`} description={service.description} structuredData={serviceStructuredData(service)} />
      <section className="section-pad bg-[radial-gradient(circle_at_top,rgba(226,27,35,.16),transparent_36%)] pt-32">
        <SectionHeading eyebrow={page.bookingEyebrow} title={service.title} copy={service.description} />
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <aside className="h-fit rounded-lg border border-white/10 bg-white/[0.035] p-6">
            <div className="grid h-14 w-14 place-items-center rounded-lg bg-gold/10 text-gold">
              <Icon />
            </div>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.22em] text-platinum/45">{page.eyebrow}</p>
            <h1 className="mt-2 text-2xl font-bold text-white">{service.title}</h1>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <span className="rounded-full border border-gold/30 px-3 py-1 font-bold text-gold">{service.price}</span>
              <span className="rounded-full border border-white/10 px-3 py-1 text-platinum/70">{service.duration}</span>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {service.benefits.map((benefit) => (
                <span key={benefit} className="rounded-full border border-white/10 px-3 py-1 text-xs text-platinum/70">
                  {benefit}
                </span>
              ))}
            </div>
            <div className="mt-6">
              <Button to="/services" variant="secondary">
                {page.eyebrow}
              </Button>
            </div>
          </aside>
          <div>
            <BookingForm preselectedServiceTitle={service.title} />
          </div>
        </div>
      </section>
    </>
  );
}
