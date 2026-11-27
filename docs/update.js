const currentRelease = '0.3.0';
const repo = 'https://github.com/reelhumann-glitch/sportshub';
const form = document.querySelector('#check-update');
const input = document.querySelector('#worker-url');
const button = form.querySelector('button');
const notice = document.querySelector('#notice');
const instructions = document.querySelector('#upgrade-instructions');
const releaseLink = document.querySelector('#release-link');
const workerName = document.querySelector('#worker-name');

function manifestUrl(value) {
  const text = value.trim();
  const url = new URL(text.includes('://') ? text : `https://${text}`);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Invalid Worker URL');
  }
  const path = url.pathname.replace(/\/+$/, '');
  url.pathname = path.endsWith('/manifest.json') ? path : `${path}/manifest.json`;
  return url;
}

function parts(value) {
  return /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value)?.slice(1).map(Number);
}

function olderThan(version, latest) {
  const mine = parts(version);
  const newest = parts(latest);
  const difference = mine.map((number, index) => number - newest[index]).find(number => number !== 0);
  return difference < 0;
}

async function latestRelease() {
  try {
    const response = await fetch('https://api.github.com/repos/reelhumann-glitch/sportshub/releases/latest', {
      credentials: 'omit', signal: AbortSignal.timeout(3500)
    });
    if (response.ok) {
      const { tag_name: tag } = await response.json();
      if (parts(tag)) return { version: tag.replace(/^v/, ''), zip: `${repo}/archive/refs/tags/${tag}.zip` };
    }
  } catch { /* The known release remains available if the API is offline. */ }
  return { version: currentRelease, zip: `${repo}/archive/refs/tags/v${currentRelease}.zip`, fallback: true };
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  let url;
  try {
    url = manifestUrl(input.value);
  } catch {
    notice.textContent = 'Enter your SportsHub Worker’s HTTPS address or manifest link.';
    input.focus();
    return;
  }
  button.disabled = true;
  instructions.hidden = true;
  notice.textContent = 'Checking your Worker…';
  try {
    const [response, release] = await Promise.all([
      fetch(url, { cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(8000) }),
      latestRelease()
    ]);
    if (!response.ok) throw new Error('Manifest is unavailable');
    const manifest = await response.json();
    if (manifest.id !== 'community.sportshub.live' || !parts(manifest.version)) {
      notice.textContent = 'This link did not return a SportsHub manifest. Use the SportsHub link installed in Nuvio.';
      return;
    }
    if (olderThan(manifest.version, release.version)) {
      releaseLink.href = release.zip;
      const name = /^([a-z0-9-]+)\.[a-z0-9-]+\.workers\.dev$/.exec(url.hostname)?.[1];
      workerName.textContent = name || 'your existing SportsHub Worker';
      notice.textContent = `You have ${manifest.version}. SportsHub ${release.version} is available.`;
      instructions.hidden = false;
    } else {
      const status = release.fallback ? `You have SportsHub ${manifest.version}.` : `You’re up to date on SportsHub ${manifest.version}.`;
      notice.textContent = `${status} You can keep your Nuvio install.`;
    }
  } catch {
    notice.textContent = 'Could not read your Worker. Check the link and try again.';
  } finally {
    button.disabled = false;
  }
});

instructions.hidden = true;
form.hidden = false;
