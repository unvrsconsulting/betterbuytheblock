// Shared HTML-generation helpers for scripts/seo/prerender.mjs — plain
// template strings, not JSX/react-dom/server (see plan doc for why).

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.description
 * @param {string} opts.canonicalUrl
 * @param {string} opts.robots
 * @param {string} opts.ogImage
 * @param {Record<string, unknown>[]} opts.jsonLdList
 * @param {string} opts.assetTags - the real <script>/<link rel=stylesheet> tags extracted from the built dist/index.html
 */
export function renderHead({ title, description, canonicalUrl, robots, ogImage, jsonLdList, assetTags }) {
  const jsonLdScripts = (jsonLdList || [])
    .map(ld => `<script type="application/ld+json">${JSON.stringify(ld)}</script>`)
    .join('\n    ');
  return `<meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#10B981" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="${escapeHtml(robots)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="BetterBuyTheBlock" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(ogImage)}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImage)}" />

    ${jsonLdScripts}
    ${assetTags}`;
}

export function renderPage({ head, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    ${head}
  </head>
  <body class="bg-gray-50">
    <div id="root">${bodyHtml}</div>
  </body>
</html>
`;
}

/** A single service+business deal card — real content + a real <a href> to the business page. */
export function renderServiceCardHtml(service, business, businessHref) {
  const discountedPrice = (service.standardPrice || 0) * (1 - (service.discountPercentage || 0) / 100);
  return `<article style="border:1px solid #e5e7eb;border-radius:16px;padding:16px;background:#fff;">
    <a href="${escapeHtml(businessHref)}" style="font-size:11px;font-weight:600;color:#059669;text-transform:uppercase;letter-spacing:0.05em;text-decoration:none;">${escapeHtml(business?.name || '')}</a>
    <h3 style="font-size:17px;font-weight:800;color:#111827;margin:4px 0;">${escapeHtml(service.title)}</h3>
    <p style="font-size:13px;color:#4b5563;margin:0 0 8px;">${escapeHtml(service.description)}</p>
    <p style="margin:0;"><strong style="font-size:20px;color:#15803d;">$${discountedPrice.toFixed(0)}</strong> <span style="font-size:13px;color:#9ca3af;text-decoration:line-through;">$${(service.standardPrice || 0).toFixed(0)}</span> <span style="font-size:11px;font-weight:700;color:#fff;background:#16a34a;border-radius:9999px;padding:2px 8px;">${service.discountPercentage}% OFF</span></p>
  </article>`;
}

/** A real-business card — real content + a real <a href> to the business page. */
export function renderBusinessCardHtml(business, businessHref) {
  return `<article style="border:1px solid #e5e7eb;border-radius:16px;padding:16px;background:#fff;">
    <a href="${escapeHtml(businessHref)}" style="text-decoration:none;color:inherit;">
      <h3 style="font-size:16px;font-weight:700;color:#111827;margin:0 0 4px;">${escapeHtml(business.name)}</h3>
      ${business.category ? `<p style="font-size:13px;color:#6b7280;margin:0;">${escapeHtml(business.category)}</p>` : ''}
    </a>
  </article>`;
}
