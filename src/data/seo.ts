import { contactDetails, socialLinks } from './site';

export const siteUrl = 'https://prestigeautodetailing.fi';

export const localBusinessStructuredData = {
  '@context': 'https://schema.org',
  '@type': ['LocalBusiness', 'AutoWash'],
  '@id': `${siteUrl}/#business`,
  name: 'Prestige Auto Detailing',
  url: siteUrl,
  image: `${siteUrl}/assets/prestige-logo.jpeg`,
  logo: `${siteUrl}/assets/prestige-logo.jpeg`,
  email: contactDetails.email,
  telephone: '+358451735304',
  priceRange: '€€',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Lantinen teollisuuskatu 23',
    postalCode: '02920',
    addressLocality: 'Espoo',
    addressCountry: 'FI',
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: '08:00',
      closes: '18:00',
    },
  ],
  areaServed: ['Espoo', 'Helsinki', 'Vantaa', 'Kauniainen'],
  sameAs: [socialLinks.instagram, socialLinks.facebook, socialLinks.tiktok],
  hasMap: contactDetails.mapsUrl,
  makesOffer: [
    'Exterior Detailing',
    'Interior Detailing',
    'Paint Correction',
    'Ceramic Coating',
    'Engine Bay Cleaning',
    'Full Detail Package',
  ],
};

export const websiteStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${siteUrl}/#website`,
  url: siteUrl,
  name: 'Prestige Auto Detailing',
  inLanguage: ['fi-FI', 'en', 'ru'],
  publisher: {
    '@id': `${siteUrl}/#business`,
  },
};

export function faqStructuredData(faqs: readonly { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export function serviceStructuredData(service: { title: string; description: string; price: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.title,
    description: service.description,
    provider: {
      '@id': `${siteUrl}/#business`,
    },
    areaServed: ['Espoo', 'Helsinki', 'Vantaa', 'Kauniainen'],
    offers: {
      '@type': 'Offer',
      priceCurrency: 'EUR',
      priceSpecification: service.price,
      availability: 'https://schema.org/InStock',
    },
  };
}
