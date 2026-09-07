const GTM_ID = 'GTM-N3VRZS5S';

// Only ever called after the visitor accepts the storage/analytics notice —
// see CookieConsentBanner. Standard GTM snippet, loaded dynamically instead
// of unconditionally in index.html so it never fires before consent.
export const loadGoogleTagManager = (): void => {
  if (typeof window === 'undefined' || (window as any).dataLayer) return;

  (window as any).dataLayer = (window as any).dataLayer || [];
  (window as any).dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  document.head.appendChild(script);

  const noscript = document.createElement('noscript');
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.googletagmanager.com/ns.html?id=${GTM_ID}`;
  iframe.height = '0';
  iframe.width = '0';
  iframe.style.display = 'none';
  iframe.style.visibility = 'hidden';
  noscript.appendChild(iframe);
  document.body.appendChild(noscript);
};
