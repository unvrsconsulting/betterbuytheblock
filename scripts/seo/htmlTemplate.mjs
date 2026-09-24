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

/** A single service+business deal card — real content + real <a href>s to the
 * business page and (when known) this specific service's own page. */
export function renderServiceCardHtml(service, business, businessHref, serviceHref) {
  const discountedPrice = (service.standardPrice || 0) * (1 - (service.discountPercentage || 0) / 100);
  const titleHtml = serviceHref
    ? `<a href="${escapeHtml(serviceHref)}" style="color:inherit;text-decoration:none;"><h3 style="font-size:17px;font-weight:800;color:#111827;margin:4px 0;">${escapeHtml(service.title)}</h3></a>`
    : `<h3 style="font-size:17px;font-weight:800;color:#111827;margin:4px 0;">${escapeHtml(service.title)}</h3>`;
  return `<article style="border:1px solid #e5e7eb;border-radius:16px;padding:16px;background:#fff;">
    <a href="${escapeHtml(businessHref)}" style="font-size:11px;font-weight:600;color:#059669;text-transform:uppercase;letter-spacing:0.05em;text-decoration:none;">${escapeHtml(business?.name || '')}</a>
    ${titleHtml}
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

// --- Guide / hub / home bodies (static, crawlable; React replaces them on load) ---

const LINK = 'color:#059669;text-decoration:none;font-weight:600;';

function crumbs(items) {
  return `<nav style="font-size:14px;margin-bottom:16px;">${items
    .map(i => (i.href ? `<a href="${escapeHtml(i.href)}" style="${LINK}">${escapeHtml(i.label)}</a>` : `<span style="color:#6b7280;">${escapeHtml(i.label)}</span>`))
    .join(' <span style="color:#9ca3af;">&rsaquo;</span> ')}</nav>`;
}

/**
 * @param {object} guide - an entry from services/seo/guides.js
 * @param {{ relatedGuides: object[], categoryHref: string|null }} ctx
 */
export function renderGuideBodyHtml(guide, { relatedGuides, categoryHref, guideHref }) {
  const sectionsHtml = (guide.sections || []).map(section => `
    <h2 style="font-size:24px;font-weight:800;color:#111827;margin:40px 0 12px;border-left:4px solid #10b981;padding-left:12px;">${escapeHtml(section.heading)}</h2>
    ${(section.paragraphs || []).map(p => `<p style="color:#374151;line-height:1.7;margin:0 0 16px;">${escapeHtml(p)}</p>`).join('')}
    ${section.bullets && section.bullets.length ? `<ul style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:16px;padding:20px 20px 20px 40px;color:#1f2937;margin:0 0 16px;">${section.bullets.map(b => `<li style="margin:6px 0;">${escapeHtml(b)}</li>`).join('')}</ul>` : ''}
    ${section.linkCategory && section.__href ? `<p><a href="${escapeHtml(section.__href)}" style="${LINK}">${escapeHtml(section.linkLabel || `See real ${section.linkCategory} deals`)} &rarr;</a></p>` : ''}`).join('');
  const related = relatedGuides.length
    ? `<section style="margin-top:48px;border-top:1px solid #e5e7eb;padding-top:24px;">
        <h2 style="font-size:20px;font-weight:800;color:#111827;margin:0 0 12px;">More cost guides</h2>
        <ul style="padding-left:20px;margin:0;">${relatedGuides.map(g => `<li style="margin:6px 0;"><a href="${escapeHtml(guideHref(g))}" style="${LINK}">${escapeHtml(g.title)}</a></li>`).join('')}</ul>
        <p><a href="/guides" style="${LINK}">See all cost guides &rarr;</a></p>
      </section>`
    : '';
  return `<article style="max-width:768px;margin:0 auto;padding:48px 24px;">
    ${crumbs([{ label: 'Home', href: '/' }, { label: 'Cost Guides', href: '/guides' }, { label: guide.category || guide.title }])}
    <img src="${escapeHtml(guide.image)}" alt="${escapeHtml(guide.title)}" style="width:100%;height:auto;border-radius:16px;margin-bottom:24px;" />
    <h1 style="font-size:34px;font-weight:800;color:#111827;line-height:1.2;margin:0 0 12px;">${escapeHtml(guide.title)}</h1>
    <p style="font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 24px;">By ${escapeHtml(guide.author)} &bull; ${escapeHtml(guide.date)}</p>
    <p style="font-size:19px;color:#4b5563;line-height:1.6;margin:0 0 24px;">${escapeHtml(guide.description)}</p>
    ${(guide.intro || []).map(p => `<p style="color:#374151;line-height:1.7;margin:0 0 16px;">${escapeHtml(p)}</p>`).join('')}
    ${sectionsHtml}
    ${(guide.closing || []).length ? `<div style="background:#ecfdf5;border:1px solid #d1fae5;border-radius:16px;padding:20px;margin-top:40px;">${guide.closing.map(p => `<p style="color:#1f2937;line-height:1.7;margin:0 0 8px;">${escapeHtml(p)}</p>`).join('')}</div>` : ''}
    ${categoryHref ? `<p style="margin-top:32px;"><a href="${escapeHtml(categoryHref)}" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:12px;">Browse all ${escapeHtml(guide.category)} deals in Wake County &rarr;</a></p>` : ''}
    ${related}
  </article>`;
}

export function renderGuidesHubBodyHtml({ guides, guideHref, categoryLinks }) {
  const cards = guides.map(g => `<article style="border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;background:#fff;">
      <a href="${escapeHtml(guideHref(g))}" style="text-decoration:none;color:inherit;display:block;">
        <img src="${escapeHtml(g.image)}" alt="${escapeHtml(g.title)}" loading="lazy" style="width:100%;height:180px;object-fit:cover;" />
        <div style="padding:16px;">
          <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 6px;">${escapeHtml(g.type || 'Guide')} &bull; ${escapeHtml(g.date)}</p>
          <h2 style="font-size:18px;font-weight:800;color:#111827;margin:0 0 8px;line-height:1.3;">${escapeHtml(g.title)}</h2>
          <p style="font-size:14px;color:#4b5563;margin:0;line-height:1.5;">${escapeHtml(g.description)}</p>
        </div>
      </a>
    </article>`).join('\n');
  return `<section style="max-width:1200px;margin:0 auto;padding:48px 24px;">
    ${crumbs([{ label: 'Home', href: '/' }, { label: 'Cost Guides' }])}
    <h1 style="font-size:36px;font-weight:800;color:#111827;margin:0 0 12px;">Cheap Home Service Cost Guides for Wake County, NC</h1>
    <p style="color:#4b5563;max-width:720px;margin:0 0 32px;font-size:18px;line-height:1.6;">Real prices for real Wake County homeowners: what home services actually cost in Raleigh, Cary, Apex and beyond, and how bundling with neighbors gets you the cheapest genuine rate.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:24px;">${cards}</div>
    <h2 style="font-size:22px;font-weight:800;color:#111827;margin:48px 0 12px;">Browse deals by category</h2>
    <p style="line-height:2;">${categoryLinks.map(c => `<a href="${escapeHtml(c.href)}" style="${LINK}margin-right:16px;white-space:nowrap;">${escapeHtml(c.label)}</a>`).join(' ')}</p>
  </section>`;
}

export function renderHomeBodyHtml({ groups, latestGuides, guideHref }) {
  const groupsHtml = groups.map(g => `<div style="margin:0 0 20px;">
      <h3 style="font-size:16px;font-weight:800;color:#111827;margin:0 0 8px;">${escapeHtml(g.name)}</h3>
      <p style="line-height:2;margin:0;">${g.categories.map(c => `<a href="${escapeHtml(c.href)}" style="${LINK}margin-right:16px;white-space:nowrap;">Cheap ${escapeHtml(c.label)}</a>`).join(' ')}</p>
    </div>`).join('');
  const guides = latestGuides.map(g => `<li style="margin:10px 0;"><a href="${escapeHtml(guideHref(g))}" style="${LINK}">${escapeHtml(g.title)}</a><br /><span style="font-size:14px;color:#6b7280;">${escapeHtml(g.description)}</span></li>`).join('');
  return `<main style="max-width:1000px;margin:0 auto;padding:48px 24px;">
    <h1 style="font-size:40px;font-weight:800;color:#111827;line-height:1.15;margin:0 0 16px;">Wake County Home Services at Discounted Rates</h1>
    <p style="font-size:19px;color:#4b5563;line-height:1.6;max-width:760px;margin:0 0 24px;">BetterBuyTheBlock is a neighborhood group-buying marketplace for Raleigh, Cary, Apex, Wake Forest and the rest of Wake County. Neighbors join the same local deal to unlock bulk pricing on cleaning, lawn care, HVAC, plumbing, roofing and more &mdash; the cheapest real rate a local business can offer, free to join and free for businesses to list.</p>
    <h2 style="font-size:26px;font-weight:800;color:#111827;margin:32px 0 16px;">Find cheap home services by category</h2>
    ${groupsHtml}
    <h2 style="font-size:26px;font-weight:800;color:#111827;margin:40px 0 12px;">Latest cost guides</h2>
    <ul style="padding-left:20px;margin:0;">${guides}</ul>
    <p style="margin-top:16px;"><a href="/guides" style="${LINK}">See all cost guides &rarr;</a></p>
  </main>`;
}
