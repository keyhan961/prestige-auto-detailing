import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

type SEOProps = {
  title: string;
  description: string;
  noIndex?: boolean;
  structuredData?: Record<string, unknown> | Record<string, unknown>[];
};

const siteUrl = 'https://prestigeautodetailing.fi';
const defaultImage = `${siteUrl}/assets/prestige-logo.jpeg`;

function upsertMeta(selector: string, create: () => HTMLMetaElement, content: string) {
  let tag = document.querySelector(selector) as HTMLMetaElement | null;
  if (!tag) {
    tag = create();
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let tag = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!tag) {
    tag = document.createElement('link');
    tag.rel = rel;
    document.head.appendChild(tag);
  }
  tag.href = href;
}

export function SEO({ title, description, noIndex = false, structuredData }: SEOProps) {
  const location = useLocation();

  useEffect(() => {
    const canonical = `${siteUrl}${location.pathname === '/' ? '/' : location.pathname}`;
    document.title = title;

    upsertMeta('meta[name="description"]', () => {
      const tag = document.createElement('meta');
      tag.name = 'description';
      return tag;
    }, description);
    upsertMeta('meta[name="robots"]', () => {
      const tag = document.createElement('meta');
      tag.name = 'robots';
      return tag;
    }, noIndex ? 'noindex,nofollow' : 'index,follow');
    upsertMeta('meta[property="og:title"]', () => {
      const tag = document.createElement('meta');
      tag.setAttribute('property', 'og:title');
      return tag;
    }, title);
    upsertMeta('meta[property="og:description"]', () => {
      const tag = document.createElement('meta');
      tag.setAttribute('property', 'og:description');
      return tag;
    }, description);
    upsertMeta('meta[property="og:url"]', () => {
      const tag = document.createElement('meta');
      tag.setAttribute('property', 'og:url');
      return tag;
    }, canonical);
    upsertMeta('meta[property="og:image"]', () => {
      const tag = document.createElement('meta');
      tag.setAttribute('property', 'og:image');
      return tag;
    }, defaultImage);
    upsertMeta('meta[name="twitter:title"]', () => {
      const tag = document.createElement('meta');
      tag.name = 'twitter:title';
      return tag;
    }, title);
    upsertMeta('meta[name="twitter:description"]', () => {
      const tag = document.createElement('meta');
      tag.name = 'twitter:description';
      return tag;
    }, description);
    upsertMeta('meta[name="twitter:image"]', () => {
      const tag = document.createElement('meta');
      tag.name = 'twitter:image';
      return tag;
    }, defaultImage);
    upsertLink('canonical', canonical);

    const existing = document.querySelector('script[data-prestige-seo="structured-data"]');
    existing?.remove();
    if (structuredData) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.dataset.prestigeSeo = 'structured-data';
      script.text = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }
  }, [description, location.pathname, noIndex, structuredData, title]);

  return null;
}
