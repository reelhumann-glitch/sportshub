import { catalogs } from './catalogs.js';

const templateUrl = 'https://raw.githubusercontent.com/reelhumann-glitch/sportshub/main/aiostreams-template.json';
const $ = selector => document.querySelector(selector);
const sections = [...document.querySelectorAll('[data-step]')];
const progress = [...document.querySelectorAll('#progress li')];
const choices = $('#catalog-list');
const notice = $('#notice');
let step = 0;

for (const catalog of catalogs) {
  const label = document.createElement('label');
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.value = catalog.id;
  box.checked = true;
  label.append(box, catalog.name);
  choices.append(label);
}

const checked = name => document.querySelector(`input[name="${name}"]:checked`).value;
const selectedCatalogs = () => [...choices.querySelectorAll('input:checked')].map(box => box.value);
const custom = () => checked('catalog-mode') === 'custom';

function refresh() {
  $('#source-setup').hidden = checked('source') !== 'setup';
  $('#catalog-options').hidden = !custom();
  $('#custom-deploy').hidden = !custom();
  $('#catalog-value-wrap').hidden = !custom();
  $('#catalog-value').value = custom() ? selectedCatalogs().join(',') : '';
  $('#back').hidden = step === 0;
  $('#next').hidden = step === sections.length - 1;
  sections.forEach((section, index) => { section.hidden = index !== step; });
  progress.forEach((item, index) => {
    if (index === step) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  });
}

function move(delta) {
  notice.textContent = '';
  if (delta > 0 && step === 1 && custom() && !selectedCatalogs().length) {
    notice.textContent = 'Select at least one catalog to continue.';
    choices.querySelector('input').focus();
    return;
  }
  step += delta;
  refresh();
  sections[step].querySelector('h2').focus();
}

function manifestLink() {
  try {
    const url = new URL($('#worker-url').value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return '';
    const path = url.pathname.replace(/\/+$/, '');
    url.pathname = path.endsWith('/manifest.json') ? path : `${path}/manifest.json`;
    return url.href;
  } catch {
    return '';
  }
}

async function copy(text, message) {
  if (!text) {
    notice.textContent = 'Enter the HTTPS address of your Cloudflare Worker first.';
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    notice.textContent = message;
  } catch {
    notice.textContent = `Copy this value manually. ${text}`;
  }
}

$('#back').addEventListener('click', () => move(-1));
$('#next').addEventListener('click', () => move(1));
document.querySelector('.panel').addEventListener('change', () => {
  notice.textContent = '';
  refresh();
});
$('#worker-url').addEventListener('input', () => { $('#manifest-preview').textContent = manifestLink(); });
$('[data-copy=template]').addEventListener('click', () => copy(templateUrl, 'Template URL copied.'));
$('[data-copy=catalogs]').addEventListener('click', () => copy($('#catalog-value').value, 'Catalog value copied.'));
$('[data-copy=manifest]').addEventListener('click', () => copy(manifestLink(), 'Install link copied.'));
refresh();
