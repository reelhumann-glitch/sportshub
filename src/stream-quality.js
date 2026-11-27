const PLAYLIST_HOSTS = new Set([
  'nuviosports.xyz', 'stream.nuviosports.xyz', 'sports.highfly.to',
  'live-pull.aisports.mobi', 'sonyeventsglobal.akamaized.net'
]);
const MAX_PROBES = 6;
const MAX_PLAYLIST_BYTES = 65536;

function resolution(value) {
  return Number(String(value ?? '').match(/\b(2160|1440|1080|720|576|540|480|360|240)p\b/i)?.[1])
    || (/\b(?:4k|uhd)\b/i.test(value) ? 2160 : 0);
}

function advertisedQuality(stream) {
  const label = [stream.resolution, stream.name, stream.title, stream.description].filter(Boolean).join(' ');
  const bitrate = label.match(/\b(\d+(?:\.\d+)?)\s*(mbps|kbps)\b/i);
  return {
    height: Number(stream.height) || resolution(label),
    bitrate: Number(stream.bitrate) || (bitrate ? Number(bitrate[1]) * (bitrate[2].toLowerCase() === 'mbps' ? 1e6 : 1e3) : 0),
    bitrateType: 'reported'
  };
}

function playlistQuality(text) {
  const variants = [...text.matchAll(/^#EXT-X-STREAM-INF:([^\r\n]+)/gm)].map(([, attributes]) => {
    const height = Number(attributes.match(/(?:^|,)RESOLUTION=\d+x(\d+)/)?.[1]) || 0;
    const average = Number(attributes.match(/(?:^|,)AVERAGE-BANDWIDTH=(\d+)/)?.[1]) || 0;
    const peak = Number(attributes.match(/(?:^|,)BANDWIDTH=(\d+)/)?.[1]) || 0;
    return { height, bitrate: average || peak, bitrateType: average ? 'avg' : 'peak' };
  }).sort((a, b) => b.height - a.height || b.bitrate - a.bitrate);
  return variants.length ? { ...variants[0], adaptive: variants.length > 1 } : null;
}

function playlistUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password && !url.port
        && PLAYLIST_HOSTS.has(url.hostname) && /\.m3u8$/i.test(url.pathname)) return url.href;
  } catch {
    return null;
  }
  return null;
}

async function readPlaylist(url) {
  try {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(1200) });
    if (!response.ok || !response.body || Number(response.headers.get('content-length')) > MAX_PLAYLIST_BYTES) return null;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    let size = 0;
    try {
      while (size <= MAX_PLAYLIST_BYTES) {
        const { value, done } = await reader.read();
        if (done) return text.startsWith('#EXTM3U') ? playlistQuality(text + decoder.decode()) : null;
        size += value.byteLength;
        if (size <= MAX_PLAYLIST_BYTES) text += decoder.decode(value, { stream: true });
      }
    } finally {
      if (size > MAX_PLAYLIST_BYTES) await reader.cancel().catch(() => {});
    }
  } catch {
    return null;
  }
  return null;
}

export async function rankStreams(candidates) {
  const entries = candidates.map(candidate => ({ ...candidate, quality: advertisedQuality(candidate.stream) }));
  const probes = new Map();
  for (const entry of entries) {
    const url = !entry.quality.bitrate && playlistUrl(entry.stream.url);
    if (!url) continue;
    if (!probes.has(url) && probes.size < MAX_PROBES) probes.set(url, readPlaylist(url));
    entry.probe = probes.get(url);
  }
  await Promise.all(entries.map(async entry => {
    const playlist = await entry.probe;
    if (playlist) entry.quality = { ...playlist, height: playlist.height || entry.quality.height };
  }));

  return entries.sort((a, b) => b.quality.height - a.quality.height
    || Number(b.language === 'english') - Number(a.language === 'english')
    || b.quality.bitrate - a.quality.bitrate)
    .map(({ stream, provider, language, languageLabel, quality }) => {
      const { name, title, description, ...playback } = stream;
      const resolutionLabel = quality.height ? `${quality.adaptive ? 'Up to ' : ''}${quality.height}p` : 'Quality unknown';
      const bitrateLabel = quality.bitrate ? `${Number((quality.bitrate / 1e6).toFixed(2))} Mbps ${quality.bitrateType}` : 'Bitrate unknown';
      const details = [...new Set([name, title, description].filter(Boolean)), `Addon: ${provider}`].join('\n');
      return { ...playback, name: [resolutionLabel, bitrateLabel, languageLabel || (language === 'english' ? 'English' : 'Language unverified')].join(' · '), description: details };
    });
}

const playlistHealth = new Map();
const PLAYLIST_HEALTH_TTL = 30_000;
const PLAYLIST_HEALTH_CACHE_SIZE = 128;
const PLAYBACK_HEADER_NAMES = new Set(['accept', 'origin', 'referer', 'user-agent']);

async function playlistIsBroken(url, headers) {
  let reader;
  try {
    const response = await fetch(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(1200) });
    if (response.status === 404 || response.status === 410) {
      await response.body?.cancel();
      return true;
    }
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      return undefined;
    }
    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let prefix = '';
    while (prefix.length < 4096) {
      const { done, value } = await reader.read();
      if (done) break;
      prefix += decoder.decode(value.subarray(0, 4096 - prefix.length), { stream: true });
      if (prefix.trimStart().length >= 7) break;
    }
    return !prefix.trimStart().startsWith('#EXTM3U');
  } catch {
    return undefined;
  } finally {
    if (reader) await reader.cancel().catch(() => {});
  }
}

export async function filterBrokenPlaylists(candidates) {
  const checks = new Map();
  const keys = candidates.map(({ stream }) => {
    const url = playlistUrl(stream.url);
    const requestHeaders = Object.entries(stream.behaviorHints?.proxyHeaders?.request || {});
    if (!url || requestHeaders.some(([name, value]) =>
      !PLAYBACK_HEADER_NAMES.has(name.toLowerCase()) || typeof value !== 'string' || /[\r\n]/.test(value))) return;
    const key = JSON.stringify([url, requestHeaders]);
    const cached = playlistHealth.get(key);
    if (cached?.expires > Date.now()) {
      checks.set(key, Promise.resolve(cached.broken));
    } else if (!checks.has(key) && checks.size < MAX_PROBES) {
      checks.set(key, playlistIsBroken(url, Object.fromEntries(requestHeaders)).then(broken => {
        if (broken !== undefined) {
          if (playlistHealth.size >= PLAYLIST_HEALTH_CACHE_SIZE) playlistHealth.delete(playlistHealth.keys().next().value);
          playlistHealth.set(key, { broken, expires: Date.now() + PLAYLIST_HEALTH_TTL });
        }
        return broken;
      }));
    }
    return key;
  });
  const broken = await Promise.all(keys.map(key => checks.get(key)));
  return candidates.filter((_, index) => broken[index] !== true);
}
