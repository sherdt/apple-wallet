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

const header = (nav, headerTitle, headerIcon) =>
  headerTitle
    ? html`<header class="top branded"><span class="brand">${headerIcon ? html`<img class="brand-icon" src="${headerIcon}" alt="" width="28" height="28">` : ''}${headerTitle}</span></header>`
    : nav ? html`<header class="top"><a class="brand" href="/admin">Wallet cards</a></header>` : '';

const layout = ({ title, body, nav = true, headerTitle, headerIcon }) => html`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${title}</title>
  <link rel="stylesheet" href="/assets/app.css">
</head>
<body>
  ${header(nav, headerTitle, headerIcon)}
  <main>${body}</main>
</body>
</html>`;

export const publicCardPage = ({ employee, company }) =>
  layout({
    title: `${employee.name}`,
    nav: false,
    body: html`
      <article class="pcard">
        ${employee.photo ? html`<img class="pcard-photo" src="/p/${employee.token}/photo.jpg" alt="" width="88" height="88">` : ''}
        <h1 class="pcard-name">${employee.name}</h1>
        ${employee.job_title ? html`<p class="pcard-title">${employee.job_title}</p>` : ''}
        <ul class="pcard-links">
          ${employee.email ? html`<li><span class="pcard-label">Email</span><a href="mailto:${employee.email}">${employee.email}</a></li>` : ''}
          ${employee.mobile ? html`<li><span class="pcard-label">Mobile</span><a href="tel:${employee.mobile}">${employee.mobile}</a></li>` : ''}
          ${employee.linkedin ? html`<li><span class="pcard-label">LinkedIn</span><a href="${employee.linkedin}" rel="noopener">${employee.linkedin}</a></li>` : ''}
          ${employee.location ? html`<li><span class="pcard-label">Location</span><span>${employee.location}</span></li>` : ''}
          ${company.address ? html`<li><span class="pcard-label">Address</span><span class="pcard-address">${company.address}</span></li>` : ''}
          ${company.website ? html`<li><span class="pcard-label">Web</span><a href="${company.website}" rel="noopener">${company.website}</a></li>` : ''}
        </ul>
        <div class="pcard-actions">
          <a class="pcard-btn primary" id="wallet-btn" href="/p/${employee.token}.pkpass">Add to Apple Wallet</a>
          <a class="pcard-btn" href="/p/${employee.token}.vcf">Save contact</a>
        </div>
        <p class="pcard-note">Apple Wallet works on iPhone and iPad. Save contact adds this card to your address book.</p>
        <p class="pcard-status" id="wallet-status" role="status" aria-live="polite"></p>
      </article>
      <script>
        (function () {
          var btn = document.getElementById('wallet-btn');
          var status = document.getElementById('wallet-status');
          var label = btn.textContent;
          var timer, poll;
          var token = location.pathname.split('/').pop();
          function reset() {
            clearTimeout(timer);
            clearInterval(poll);
            document.cookie = 'pkpass_ready=; Path=/; Max-Age=0';
            btn.textContent = label;
            btn.classList.remove('busy');
            btn.removeAttribute('aria-disabled');
            status.textContent = '';
          }
          btn.addEventListener('click', function (e) {
            if (btn.classList.contains('busy')) { e.preventDefault(); return; }
            btn.textContent = 'Creating your card…';
            btn.classList.add('busy');
            btn.setAttribute('aria-disabled', 'true');
            status.textContent = 'This can take a few seconds. Please wait.';
            timer = setTimeout(reset, 20000);
            // The server sets pkpass_ready once the .pkpass response has been sent.
            poll = setInterval(function () {
              if (document.cookie.indexOf('pkpass_ready=' + token) !== -1) reset();
            }, 500);
          });
          window.addEventListener('pageshow', reset);
        })();
      </script>`,
  });

export const notFoundPage = () =>
  layout({
    title: 'Not found',
    nav: false,
    body: html`<h1>Not found</h1><p>This card does not exist or the link has been revoked.</p>`,
  });
