import { SEO } from '../components/SEO';
import { SectionHeading } from '../components/SectionHeading';
import { ServiceCard } from '../components/ServiceCard';
import { useLanguage } from '../i18n';
import { serviceBookingPath } from '../utils/serviceRoutes';

export function Services() {
  const { content } = useLanguage();
  const page = content.pages.services;

  return (
    <>
      <SEO title={page.seoTitle} description={page.seoDescription} />
      <section className="section-pad bg-[radial-gradient(circle_at_top,rgba(226,27,35,.16),transparent_36%)] pt-32">
        <SectionHeading eyebrow={page.eyebrow} title={page.title} copy={page.copy} />
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2 lg:grid-cols-3">
          {content.services.map((service, index) => (
            <ServiceCard key={service.title} service={service} actionLabel={content.common.bookShort} actionTo={serviceBookingPath(index)} />
          ))}
        </div>
      </section>
    </>
  );
}
