// Server-rendered HTML. Every interpolated value is HTML-escaped unless it is a
// Safe fragment (returned by html or raw), so user input cannot inject markup.
// No inline scripts or styles: public/app.css is served under a strict Content-Security-Policy.

class Safe {
  constructor(value) {
    this.value = value;
  }

  toString() {
    return this.value;
  }
}

export const raw = (value) => new Safe(String(value));

function escape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const render = (value) => (value instanceof Safe ? value.value : escape(value));

export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((value, i) => {
    out += Array.isArray(value) ? value.map(render).join('') : render(value);
    out += strings[i + 1];
  });
  return raw(out);
}

const header = (nav, headerTitle) =>
  headerTitle
    ? html`<header class="top branded"><span class="brand">${headerTitle}</span></header>`
    : html`<header class="top">${nav ? html`<a class="brand" href="/admin">Wallet cards</a>` : ''}</header>`;

const layout = ({ title, body, nav = true, headerTitle }) => html`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${title}</title>
  <link rel="stylesheet" href="/assets/app.css">
</head>
<body>
  ${header(nav, headerTitle)}
  <main>${body}</main>
</body>
</html>`;

export const publicCardPage = ({ employee, company }) =>
  layout({
    title: `${employee.name}`,
    nav: false,
    headerTitle: company.name,
    body: html`
      <article class="business-card">
        <h1>${employee.name}</h1>
        ${employee.job_title ? html`<p>${employee.job_title}</p>` : ''}
        <ul class="contact">
          ${employee.email ? html`<li><a href="mailto:${employee.email}">${employee.email}</a></li>` : ''}
          ${employee.mobile ? html`<li><a href="tel:${employee.mobile}">${employee.mobile} (mobile)</a></li>` : ''}
          ${company.website ? html`<li><a href="${company.website}" rel="noopener">${company.website}</a></li>` : ''}
        </ul>
        <div class="actions">
          <a class="button" href="/p/${employee.token}.pkpass">Add to Apple Wallet</a>
          <a class="button secondary" href="/p/${employee.token}.vcf">Save contact</a>
        </div>
        <p class="hint">“Add to Apple Wallet” works on iPhone and iPad. “Save contact” adds the details to your address book.</p>
      </article>`,
  });

export const notFoundPage = () =>
  layout({
    title: 'Not found',
    nav: false,
    body: html`<h1>Not found</h1><p>This card does not exist or the link has been revoked.</p>`,
  });
