const API = 'https://wild-cherry-b868.samtesting67.workers.dev';

const HOME_SECTIONS = [
  { id: 'bollywood', title: '🎵 Bollywood Hot Hits', type: 'search', value: 'latest bollywood songs 2024 "Provided to YouTube"' },
  { id: 'classics', title: '📻 All Time Hindi Classics', type: 'search', value: 'best 90s hindi romantic songs "Provided to YouTube"' },
  { id: 'tseries', title: '🔥 Latest from T-Series', type: 'playlist', value: 'UUq-Fj5jknLsUf-MWSy4_brA' },
  { id: 'international', title: '🎤 International Hits', type: 'search', value: 'international best songs "Provided to YouTube"' },
  { id: 'lofi', title: '☕ Chill Lofi Beats', type: 'playlist', value: 'UUSJ4gkVC6NrvII8umztf0Ow' }
];

/* ── Smart Cache ── */
const CACHE_TTL = {
  search: 12 * 60 * 60 * 1000,
  playlist: 24 * 60 * 60 * 1000
};

function getCached(key) {
  try {
    const raw = localStorage.getItem('rc_' + key);
    if (!raw) return null;
    const { data, ts, ttl } = JSON.parse(raw);
    return { data, expired: Date.now() - ts > ttl };
  } catch { return null; }
}

function setCache(key, data, ttl) {
  try {
    localStorage.setItem('rc_' + key, JSON.stringify({ data, ts: Date.now(), ttl }));
  } catch {}
}

/* ── DOM refs ── */
const els = {
  results: document.getElementById('results'),
  status: document.getElementById('status'),
  secHeader: document.getElementById('section-header'),
  secTitle: document.getElementById('section-title'),
  searchInput: document.getElementById('search-input'),
  pThumb: document.getElementById('p-thumb'),
  pTitle: document.getElementById('p-title'),
  pArtist: document.getElementById('p-artist'),
  progFill: document.getElementById('prog-fill'),
  progBar: document.getElementById('prog-bar'),
  tCur: document.getElementById('t-cur'),
  tTot: document.getElementById('t-tot'),
  ppBtn: document.getElementById('pp-btn'),
  playIcon: document.getElementById('play-icon'),
  pauseIcon: document.getElementById('pause-icon'),
  nextBtn: document.getElementById('next-btn'),
  prevBtn: document.getElementById('prev-btn'),
  volBar: document.getElementById('vol-bar'),
  volFill: document.getElementById('vol-fill'),
  playerBar: document.getElementById('player-bar'),
  npOverlay: document.getElementById('np-overlay'),
  npBackdrop: document.getElementById('np-backdrop'),
  npBgImg: document.getElementById('np-bg-img'),
  npCloseBtn: document.getElementById('np-close-btn'),
  npArtWrap: document.getElementById('np-art-wrap'),
  npArtCover: document.getElementById('np-art-cover'),
  npSongTitle: document.getElementById('np-song-title'),
  npSongArtist: document.getElementById('np-song-artist'),
  npProgFill: document.getElementById('np-prog-fill'),
  npProgBar: document.getElementById('np-prog-bar'),
  npTCur: document.getElementById('np-t-cur'),
  npTTot: document.getElementById('np-t-tot'),
  npPpBtn: document.getElementById('np-pp-btn'),
  npPlayIcon: document.getElementById('np-play-icon'),
  npPauseIcon: document.getElementById('np-pause-icon'),
  npNextBtn: document.getElementById('np-next-btn'),
  npPrevBtn: document.getElementById('np-prev-btn'),
  vidToggleBtn: document.getElementById('vid-toggle-btn'),
  vidLabel: document.getElementById('vid-label'),
  vidIconVideo: document.getElementById('vid-icon-video'),
  vidIconAudio: document.getElementById('vid-icon-audio'),
  navHome: document.getElementById('nav-home'),
  navSearch: document.getElementById('nav-search'),
  navLibrary: document.getElementById('nav-library'),
  mobHome: document.getElementById('mob-home'),
  mobSearch: document.getElementById('mob-search'),
  mobLibrary: document.getElementById('mob-library'),
  viewHome: document.getElementById('view-home'),
  viewSearch: document.getElementById('view-search'),
  viewLibrary: document.getElementById('view-library'),
  libStatus: document.getElementById('lib-status'),
  libResults: document.getElementById('lib-results'),
  npLikeBtn: document.getElementById('np-like-btn'),
  iconHeartOutline: document.getElementById('icon-heart-outline'),
  iconHeartFilled: document.getElementById('icon-heart-filled'),
  homeBody: document.getElementById('home-body'),
  homeGreeting: document.getElementById('home-greeting'),
  main: document.getElementById('main')
};

/* ── State ── */
let tracks = [], currentIdx = -1, isPlaying = false;
let progTimer = null, duration = 0;
let ytPlayer = null, ytReady = false;
let activeEl = null, queueEl = null;
let currentItem = null;
let videoMode = false, panelOpen = false;
let currentVolume = 70;

/* ── Security ── */
function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, match => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[match]));
}

/* ── Search Suggestions ── */

const getSuggestions = async (query) => {
  try {
    const res = await fetch(
      `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(query)}`
    );
    const data = await res.json();
    return data[1] || [];
  } catch {
    return [];
  }
};

function showSuggestions(suggestions) {
  let box = document.getElementById('suggest-box');

  if (!box) {
    box = document.createElement('div');
    box.id = 'suggest-box';

    // 🔥 safer attach (not parentNode guess)
    document.body.appendChild(box);
  }

  if (!suggestions.length) {
    box.style.display = 'none';
    return;
  }

  // Position under input (CRITICAL FIX)
  const rect = els.searchInput.getBoundingClientRect();
  box.style.position = 'absolute';
  box.style.top = rect.bottom + window.scrollY + 6 + 'px';
  box.style.left = rect.left + window.scrollX + 'px';
  box.style.width = rect.width + 'px';

  box.innerHTML = suggestions
    .map(s => `<div class="suggest-item">${escapeHTML(s)}</div>`)
    .join('');

  box.style.display = 'block';

  box.querySelectorAll('.suggest-item').forEach(item => {
    item.addEventListener('mousedown', e => {
      e.preventDefault();
      els.searchInput.value = item.textContent;
      hideSuggestions();
      search(item.textContent);
    });
  });
}

function hideSuggestions() {
  const box = document.getElementById('suggest-box');
  if (box) box.style.display = 'none';
}

/* ── Thumbnail quality upgrade ── */
function hdThumb(url) {
  if (!url) return '';
  return url.replace(/\/(default|mqdefault|sddefault)\.(jpg|webp)/, '/hqdefault.$2');
}

/* ── YT IFrame API ── */
window.onYouTubeIframeAPIReady = () => {
  ytReady = true;
  ytPlayer = new YT.Player('yt-player-frame', {
    width: '100%', height: '100%',
    playerVars: { autoplay: 0, playsinline: 1, controls: 1, rel: 0, modestbranding: 1 },
    events: {
      onReady(e) { e.target.setVolume(currentVolume); },
      onStateChange(e) {
        const S = YT.PlayerState;
        if (e.data === S.PLAYING) {
          isPlaying = true; showPauseAll();
          if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
          try { duration = ytPlayer.getDuration(); updateTotLabel(); } catch (_) {}
          startLoop();
        }
        if (e.data === S.PAUSED) {
          isPlaying = false; showPlayAll(); stopLoop();
          if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
        }
        if (e.data === S.ENDED) { playNext(); }
      }
    }
  });
};

/* ── UI helpers ── */
function fmt(s) { s = Math.floor(s || 0); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

function showPlayAll() {
  els.playIcon.style.display = ''; els.pauseIcon.style.display = 'none';
  els.npPlayIcon.style.display = ''; els.npPauseIcon.style.display = 'none';
  const mobIcon = document.getElementById('mob-pp-btn');
  if (mobIcon) mobIcon.innerHTML = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
}

function showPauseAll() {
  els.playIcon.style.display = 'none'; els.pauseIcon.style.display = '';
  els.npPlayIcon.style.display = 'none'; els.npPauseIcon.style.display = '';
  const mobIcon = document.getElementById('mob-pp-btn');
  if (mobIcon) mobIcon.innerHTML = `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
}

function updateTotLabel() {
  const d = fmt(duration);
  els.tTot.textContent = d;
  els.npTTot.textContent = d;
}

function setNav(v) {
  if (els.navHome) els.navHome.classList.toggle('active', v === 'home');
  if (els.navSearch) els.navSearch.classList.toggle('active', v === 'search');
  if (els.navLibrary) els.navLibrary.classList.toggle('active', v === 'library');
  if (els.mobHome) els.mobHome.classList.toggle('active', v === 'home');
  if (els.mobSearch) els.mobSearch.classList.toggle('active', v === 'search');
  if (els.mobLibrary) els.mobLibrary.classList.toggle('active', v === 'library');
}

function showHome() {
  els.viewHome.style.display = '';
  els.viewSearch.style.display = 'none';
  els.viewLibrary.style.display = 'none';
  setNav('home');
  els.main.scrollTo({ top: 0, behavior: 'smooth' });
  if (new URL(location.href).searchParams.get('q')) {
    history.pushState({ page: 'home' }, '', location.pathname);
  }
  if (!els.homeBody.children.length) initHome();
}

function showSearch() {
  els.viewHome.style.display = 'none';
  els.viewLibrary.style.display = 'none';
  els.viewSearch.style.display = '';
  setNav('search');
  setTimeout(() => els.searchInput.focus(), 80);
}

function showLibrary() {
  els.viewHome.style.display = 'none';
  els.viewSearch.style.display = 'none';
  els.viewLibrary.style.display = 'block';
  setNav('library');
  renderLibrary();
}

/* ── Library Persistent Storage ── */
function getLibrary() {
  try { return JSON.parse(localStorage.getItem('raaga_lib') || '[]'); }
  catch (e) { return []; }
}

function saveLibrary(list) {
  localStorage.setItem('raaga_lib', JSON.stringify(list));
}

function toggleLike() {
  if (!currentItem) return;
  let lib = getLibrary();
  const exists = lib.findIndex(t => t.videoId === currentItem.videoId);
  if (exists > -1) { lib.splice(exists, 1); } else { lib.unshift(currentItem); }
  saveLibrary(lib);
  updateLikeUI();
  if (els.viewLibrary.style.display !== 'none') renderLibrary();
}

function updateLikeUI() {
  if (!currentItem) return;
  const isLiked = getLibrary().some(t => t.videoId === currentItem.videoId);
  els.iconHeartOutline.style.display = isLiked ? 'none' : 'block';
  els.iconHeartFilled.style.display = isLiked ? 'block' : 'none';
}

function renderLibrary() {
  const lib = getLibrary();
  els.libResults.innerHTML = '';
  if (!lib.length) { els.libStatus.style.display = 'flex'; return; }
  els.libStatus.style.display = 'none';
  lib.forEach((item, i) => {
    const { title, artist } = parseTitleArtist(item.title || '');
    const row = document.createElement('div');
    row.className = 'trow';
    row.innerHTML = `
      <div class="tnum"><span class="n">${i + 1}</span><span class="pb">▶</span></div>
      <img class="tthumb" src="${escapeHTML(hdThumb(item.thumbnail || ''))}" onerror="this.style.opacity=0" alt=""/>
      <div class="tinfo">
        <div class="ttitle">${escapeHTML(title)}</div>
        ${artist ? `<div class="tartist">${escapeHTML(artist)}</div>` : ''}
      </div>
      <div class="eq"><div class="eqb"></div><div class="eqb"></div><div class="eqb"></div></div>`;
    row.addEventListener('click', () => { tracks = lib; playFromRow(item, row, i); });
    els.libResults.appendChild(row);
  });
}

/* ── Progress loop ── */
function updateProgressUI() {
  if (!ytPlayer?.getCurrentTime) return;
  const t = ytPlayer.getCurrentTime();
  if (!duration || duration <= 0) {
    try {
      const d = ytPlayer.getDuration();
      if (d > 0) { duration = d; updateTotLabel(); }
    } catch (_) {}
  }
  const pct = duration > 0 ? (t / duration) * 100 : 0;
  if (els.progFill) els.progFill.style.width = pct + '%';
  if (els.npProgFill) els.npProgFill.style.width = pct + '%';
  if (els.playerBar) els.playerBar.style.setProperty('--mob-prog', pct + '%');
  const f = fmt(t);
  if (els.tCur) els.tCur.textContent = f;
  if (els.npTCur) els.npTCur.textContent = f;
  if ('mediaSession' in navigator && navigator.mediaSession.setPositionState && duration > 0) {
    try {
      navigator.mediaSession.setPositionState({
        duration, playbackRate: 1.0, position: Math.min(t, duration)
      });
    } catch (e) {}
  }
}

function startLoop() { stopLoop(); updateProgressUI(); progTimer = setInterval(updateProgressUI, 800); }
function stopLoop() { if (progTimer) { clearInterval(progTimer); progTimer = null; } }

/* ── Home sections ── */
function buildShimmerSection(sec) {
  const block = document.createElement('div');
  block.className = 'sec-block'; block.id = `blk-${sec.id}`;
  block.innerHTML = `
    <div class="sec-head"><span class="sec-title">${escapeHTML(sec.title)}</span></div>
    <div class="sec-scroll" id="scr-${sec.id}">
      ${Array(7).fill(0).map(() => `
        <div class="mcard">
          <div class="mcard-art shimmer-art"></div>
          <div class="shimmer-line w80"></div>
          <div class="shimmer-line w55"></div>
        </div>`).join('')}
    </div>`;
  els.homeBody.appendChild(block);
}

function parseTitleArtist(raw) {
  const p = raw.split(' - ');
  return p.length > 1 ? { artist: p[0], title: p.slice(1).join(' - ') } : { artist: '', title: raw };
}

function populateSection(sec, items) {
  const scrollEl = document.getElementById(`scr-${sec.id}`);
  if (!scrollEl) return;
  scrollEl.innerHTML = '';
  items.forEach((item, i) => {
    const { title, artist } = parseTitleArtist(item.title || '');
    const card = document.createElement('div');
    card.className = 'mcard';
    card.innerHTML = `
      <div class="mcard-art">
        <img class="mcard-img" src="${escapeHTML(hdThumb(item.thumbnail))}" onerror="this.style.opacity=0" alt=""/>
        <div class="mcard-overlay"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
      </div>
      <div class="mcard-title">${escapeHTML(title)}</div>
      <div class="mcard-artist">${escapeHTML(artist)}</div>`;
    card.addEventListener('click', () => { tracks = items; playFromSection(items, i, card, scrollEl); });
    scrollEl.appendChild(card);
  });
}

async function loadSection(sec, delay) {
  await new Promise(r => setTimeout(r, delay));
  const cacheKey = `${sec.type}_${sec.value}`;
  const ttl = CACHE_TTL[sec.type] || CACHE_TTL.search;
  const cached = getCached(cacheKey);

  if (cached) {
    populateSection(sec, cached.data);
    if (!cached.expired) return;
    try {
      const endpoint = sec.type === 'playlist'
        ? `${API}/playlist?id=${sec.value}`
        : `${API}/search?q=${encodeURIComponent(sec.value)}`;
      const res = await fetch(endpoint);
      const data = await res.json();
      if (data?.length) { setCache(cacheKey, data, ttl); populateSection(sec, data); }
    } catch {}
    return;
  }

  try {
    const endpoint = sec.type === 'playlist'
      ? `${API}/playlist?id=${sec.value}`
      : `${API}/search?q=${encodeURIComponent(sec.value)}`;
    const res = await fetch(endpoint);
    const data = await res.json();
    if (data?.length) {
      setCache(cacheKey, data, ttl);
      populateSection(sec, data);
    } else {
      document.getElementById(`scr-${sec.id}`).innerHTML =
        '<span style="color:var(--text-muted);font-size:.85rem;padding:.5rem 0;display:block">Nothing found</span>';
    }
  } catch {
    const fallback = getCached(cacheKey);
    if (fallback) populateSection(sec, fallback.data);
    else document.getElementById(`scr-${sec.id}`).innerHTML =
      '<span style="color:var(--text-muted);font-size:.85rem;padding:.5rem 0;display:block">Couldn\'t load</span>';
  }
}

function initHome() {
  els.homeBody.innerHTML = '';
  const h = new Date().getHours();
  const greet = h < 5 ? 'Late Night 🌙' : h < 12 ? 'Good Morning ☀️' : h < 17 ? 'Good Afternoon 🌤️' : h < 21 ? 'Good Evening 🌙' : 'Good Night ✨';
  if (els.homeGreeting) els.homeGreeting.textContent = greet;
  HOME_SECTIONS.forEach((sec, i) => { buildShimmerSection(sec); loadSection(sec, i * 250); });
}

/* ── Playback Logic ── */
function setActive(el) {
  if (activeEl) activeEl.classList.remove('playing');
  activeEl = el; if (el) el.classList.add('playing');
}
function playFromSection(items, idx, cardEl, containerEl) {
  setActive(cardEl); currentIdx = idx; queueEl = containerEl; playItem(items[idx]);
}
function playFromRow(item, rowEl, idx) {
  setActive(rowEl); currentIdx = idx; queueEl = els.results; playItem(item);
}

async function playItem(item) {
  currentItem = item;
  updateMediaSession(item);
  const { title, artist } = parseTitleArtist(item.title || '');
  if (videoMode) setVideoMode(false);

  els.pThumb.src = hdThumb(item.thumbnail);
  els.pTitle.textContent = title || item.title;
  els.pArtist.textContent = artist;
  if (els.npSongTitle) els.npSongTitle.textContent = title || item.title;
  if (els.npSongArtist) els.npSongArtist.textContent = artist;
  if (els.npArtCover) {
    els.npArtCover.style.opacity = '1';
    els.npArtCover.onerror = () => { els.npArtCover.style.opacity = '0'; };
    els.npArtCover.src = hdThumb(item.thumbnail);
  }
  if (els.npBgImg) {
    els.npBgImg.onerror = () => { els.npBgImg.style.opacity = '0'; };
    els.npBgImg.src = hdThumb(item.thumbnail);
  }

  duration = 0;
  els.progFill.style.width = '0%';
  els.npProgFill.style.width = '0%';
  els.tCur.textContent = '0:00'; els.tTot.textContent = '0:00';
  els.npTCur.textContent = '0:00'; els.npTTot.textContent = '0:00';

  openNowPlaying();
  showPauseAll();
  updateLikeUI();

  if (ytPlayer && ytReady) {
    ytPlayer.loadVideoById({ videoId: item.videoId });
  } else {
    const t = setInterval(() => {
      if (ytReady && ytPlayer) { clearInterval(t); ytPlayer.loadVideoById({ videoId: item.videoId }); }
    }, 100);
  }
}

function playNext() {
  if (currentIdx >= tracks.length - 1) return;
  currentIdx++;
  const item = tracks[currentIdx];
  if (queueEl) { const el = queueEl.children[currentIdx]; setActive(el || null); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  playItem(item);
}
function playPrev() {
  if (currentIdx <= 0) return;
  currentIdx--;
  const item = tracks[currentIdx];
  if (queueEl) { const el = queueEl.children[currentIdx]; setActive(el || null); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  playItem(item);
}

/* ── Video / audio mode ── */
function setVideoMode(on) {
  videoMode = on;
  const ytFrame = document.getElementById('yt-player-frame');
  const customControls = document.querySelector('.np-bottom');
  const customFsBtn = document.getElementById('np-fs-btn');
  if (on) {
    els.npArtWrap.classList.add('video-mode');
    els.vidLabel.textContent = 'Switch to Audio';
    els.vidIconVideo.style.display = 'none'; els.vidIconAudio.style.display = '';
    els.vidToggleBtn.classList.add('on');
    ytFrame.style.pointerEvents = 'auto';
    customControls.style.display = 'none';
    if (customFsBtn) customFsBtn.style.display = 'flex';
    if (els.npArtCover) els.npArtCover.style.opacity = '0';
  } else {
    els.npArtWrap.classList.remove('video-mode');
    els.vidLabel.textContent = 'Switch to Video';
    els.vidIconVideo.style.display = ''; els.vidIconAudio.style.display = 'none';
    els.vidToggleBtn.classList.remove('on');
    ytFrame.style.pointerEvents = 'none';
    customControls.style.display = 'flex';
    if (customFsBtn) customFsBtn.style.display = 'none';
    if (els.npArtCover) els.npArtCover.style.opacity = '1';
  }
}

/* ── UI Panel Controls ── */
function openNowPlaying() {
  if (!panelOpen) history.pushState({ panel: 'nowplaying' }, '');
  panelOpen = true;
  els.npOverlay.classList.add('open');
}
function closeNowPlaying() { panelOpen = false; els.npOverlay.classList.remove('open'); }

/* ── Events ── */
if (els.navHome) els.navHome.addEventListener('click', showHome);
if (els.navSearch) els.navSearch.addEventListener('click', showSearch);
if (els.navLibrary) els.navLibrary.addEventListener('click', showLibrary);
if (els.mobHome) els.mobHome.addEventListener('click', showHome);
if (els.mobSearch) els.mobSearch.addEventListener('click', showSearch);
if (els.mobLibrary) els.mobLibrary.addEventListener('click', showLibrary);

if (els.npLikeBtn) els.npLikeBtn.addEventListener('click', e => { e.stopPropagation(); toggleLike(); });

const handlePP = e => { e.stopPropagation(); if (!ytPlayer) return; isPlaying ? ytPlayer.pauseVideo() : ytPlayer.playVideo(); };
els.ppBtn.addEventListener('click', handlePP);
els.npPpBtn.addEventListener('click', handlePP);
const mobPpBtn = document.getElementById('mob-pp-btn');
if (mobPpBtn) mobPpBtn.addEventListener('click', handlePP);
els.nextBtn.addEventListener('click', e => { e.stopPropagation(); playNext(); });
els.prevBtn.addEventListener('click', e => { e.stopPropagation(); playPrev(); });
els.npNextBtn.addEventListener('click', e => { e.stopPropagation(); playNext(); });
els.npPrevBtn.addEventListener('click', e => { e.stopPropagation(); playPrev(); });

els.progBar.addEventListener('click', e => {
  if (!ytPlayer || !duration) return;
  const r = els.progBar.getBoundingClientRect();
  ytPlayer.seekTo(((e.clientX - r.left) / r.width) * duration, true);
});
els.npProgBar.addEventListener('click', e => {
  if (!ytPlayer || !duration) return;
  const r = els.npProgBar.getBoundingClientRect();
  ytPlayer.seekTo(((e.clientX - r.left) / r.width) * duration, true);
});

els.volBar.addEventListener('click', e => {
  const r = els.volBar.getBoundingClientRect();
  currentVolume = Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 100);
  els.volFill.style.width = currentVolume + '%';
  if (ytPlayer?.setVolume) ytPlayer.setVolume(currentVolume);
});

els.playerBar.addEventListener('click', e => {
  if (e.target.closest('button,.prog-bar,.vol-bar')) return;
  if (currentItem) openNowPlaying();
});

let _sy = 0;
els.playerBar.addEventListener('touchstart', e => { _sy = e.touches[0].clientY; }, { passive: true });
els.playerBar.addEventListener('touchend', e => { if (_sy - e.changedTouches[0].clientY > 30 && currentItem) openNowPlaying(); }, { passive: true });

/* ── Spotify-style drag-to-close ── */
let _nsy = 0, _nsx = 0, _npDragging = false, _npDragStartTime = 0;
const npPanelEl = document.querySelector('.np-panel');

npPanelEl.addEventListener('touchstart', e => {
  _nsy = e.touches[0].clientY; _nsx = e.touches[0].clientX;
  _npDragging = false; _npDragStartTime = Date.now();
  npPanelEl.style.transition = 'none'; els.npOverlay.style.transition = 'none';
}, { passive: true });

npPanelEl.addEventListener('touchmove', e => {
  if (isFullscreen) return;
  const dy = e.touches[0].clientY - _nsy;
  const dx = e.touches[0].clientX - _nsx;
  if (dy <= 5 || Math.abs(dx) > Math.abs(dy) * 1.5) return;
  _npDragging = true;
  npPanelEl.style.transform = `translateY(${Math.min(dy, window.innerHeight * 0.9)}px)`;
  const alpha = Math.max(0, 1 - dy / (window.innerHeight * 0.55));
  els.npOverlay.style.opacity = String(alpha);
}, { passive: true });

npPanelEl.addEventListener('touchend', e => {
  if (!_npDragging) { npPanelEl.style.transition = ''; els.npOverlay.style.transition = ''; return; }
  _npDragging = false;
  const dy = e.changedTouches[0].clientY - _nsy;
  const elapsed = Math.max(1, Date.now() - _npDragStartTime);
  const velocity = dy / elapsed;
  const threshold = videoMode ? 140 : 80;
  if (dy > threshold || velocity > 0.7) {
    npPanelEl.style.transition = 'transform 0.38s cubic-bezier(0.32,0.72,0,1)';
    els.npOverlay.style.transition = 'opacity 0.38s ease';
    npPanelEl.style.transform = 'translateY(100vh)';
    els.npOverlay.style.opacity = '0';
    setTimeout(() => {
      panelOpen = false; els.npOverlay.classList.remove('open');
      npPanelEl.style.transform = ''; npPanelEl.style.transition = '';
      els.npOverlay.style.opacity = ''; els.npOverlay.style.transition = '';
    }, 400);
  } else {
    npPanelEl.style.transition = 'transform 0.4s cubic-bezier(0.32,0.72,0,1)';
    els.npOverlay.style.transition = 'opacity 0.4s ease';
    npPanelEl.style.transform = 'translateY(0)';
    els.npOverlay.style.opacity = '1';
    setTimeout(() => {
      npPanelEl.style.transform = ''; npPanelEl.style.transition = '';
      els.npOverlay.style.opacity = ''; els.npOverlay.style.transition = '';
    }, 420);
  }
}, { passive: true });

els.vidToggleBtn.addEventListener('click', e => { e.stopPropagation(); setVideoMode(!videoMode); });

/* ── Fullscreen Toggle ── */
const npFsBtn = document.getElementById('np-fs-btn');
let isFullscreen = false;

async function toggleFullscreen() {
  isFullscreen = !isFullscreen;
  els.npOverlay.classList.toggle('fullscreen', isFullscreen);
  try {
    if (isFullscreen) {
      if (videoMode) {
        const ytIframe = document.querySelector('#yt-player-frame iframe');
        const target = ytIframe || els.npArtWrap;
        const p = target.requestFullscreen?.() ?? target.webkitRequestFullscreen?.();
        if (p?.catch) p.catch(() => {});
        if (screen.orientation?.lock) screen.orientation.lock('landscape').catch(() => {});
      } else {
        const p = els.npOverlay.requestFullscreen?.() ?? els.npOverlay.webkitRequestFullscreen?.();
        if (p?.catch) p.catch(() => {});
      }
    } else {
      if (document.fullscreenElement) await document.exitFullscreen?.();
      if (screen.orientation?.unlock) screen.orientation.unlock();
    }
  } catch (e) {}
}

if (npFsBtn) npFsBtn.addEventListener('click', e => { e.stopPropagation(); toggleFullscreen(); });
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && isFullscreen) {
    isFullscreen = false; els.npOverlay.classList.remove('fullscreen');
    if (screen.orientation?.unlock) screen.orientation.unlock();
  }
});

els.npBackdrop.addEventListener('click', closeNowPlaying);
els.npCloseBtn.addEventListener('click', () => { if (isFullscreen) toggleFullscreen(); else closeNowPlaying(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (isFullscreen) { isFullscreen = false; els.npOverlay.classList.remove('fullscreen'); }
    else if (panelOpen) closeNowPlaying();
  }
});

// Hide suggestions when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('#suggest-box') && !e.target.closest('#search-input')) {
    hideSuggestions();
  }
});

/* ── Master Search ── */
async function search(q, pushState = true) {
  if (!q.trim()) return;
  hideSuggestions(); // Always hide suggestions when search fires
  if (pushState) {
    const u = new URL(location.href);
    u.searchParams.set('q', q);
    history.pushState({ q }, '', u);
  }
  showSearch();
  els.searchInput.value = q;
  els.status.style.display = 'none';
  els.secHeader.style.display = 'none';
  els.results.innerHTML = Array(8).fill(0).map(() => `
    <div class="skel-row">
      <div class="skel-thumb"></div>
      <div class="skel-info">
        <div class="skel-title"></div>
        <div class="skel-artist"></div>
      </div>
    </div>`).join('');
  tracks = []; currentIdx = -1; queueEl = els.results;

  try {
    let endpoint = '', displayTitle = '', cacheKey = '';
    if (q.includes('list=')) {
      let playlistId = '';
      try {
        const parsedUrl = new URL(q);
        playlistId = parsedUrl.searchParams.get('list');
      } catch (e) {
        const match = q.match(/list=([a-zA-Z0-9_-]+)/);
        if (match) playlistId = match[1];
      }
      if (playlistId) {
        endpoint = `${API}/playlist?id=${playlistId}`;
        displayTitle = `Loaded Playlist`;
        cacheKey = 'pl_' + playlistId;
      } else {
        endpoint = `${API}/search?q=${encodeURIComponent(q)}`;
        displayTitle = `Results for "${q}"`;
        cacheKey = 'search_' + q;
      }
    } else {
      endpoint = `${API}/search?q=${encodeURIComponent(q)}`;
      displayTitle = `Results for "${q}"`;
      cacheKey = 'search_' + q;
    }

    const cached = getCached(cacheKey);
    let data = cached?.data || null;

    if (!data) {
      const res = await fetch(endpoint);
      data = await res.json();
      if (data?.length) setCache(cacheKey, data, CACHE_TTL.search);
    } else if (cached.expired) {
      fetch(endpoint).then(r => r.json())
        .then(fresh => { if (fresh?.length) setCache(cacheKey, fresh, CACHE_TTL.search); })
        .catch(() => {});
    }

    els.status.style.display = 'none';
    if (!data?.length) {
      els.results.innerHTML = '';
      els.status.innerHTML = '<div class="status-icon">🎵</div><div>No results found.</div>';
      els.status.style.display = 'flex';
      return;
    }

    tracks = data;
    els.secHeader.style.display = '';
    els.secTitle.textContent = displayTitle;
    els.results.innerHTML = '';

    data.forEach((item, i) => {
      const { title, artist } = parseTitleArtist(item.title || '');
      const row = document.createElement('div');
      row.className = 'trow';
      row.style.animationDelay = `${i * 0.028}s`;
      row.innerHTML = `
        <div class="tnum"><span class="n">${i + 1}</span><span class="pb">▶</span></div>
        <img class="tthumb" src="${escapeHTML(hdThumb(item.thumbnail || ''))}" onerror="this.style.opacity=0" alt=""/>
        <div class="tinfo">
          <div class="ttitle">${escapeHTML(title)}</div>
          ${artist ? `<div class="tartist">${escapeHTML(artist)}</div>` : ''}
        </div>
        <div class="eq"><div class="eqb"></div><div class="eqb"></div><div class="eqb"></div></div>`;
      row.addEventListener('click', () => { tracks = data; playFromRow(item, row, i); });
      els.results.appendChild(row);
    });
  } catch {
    els.results.innerHTML = '';
    els.status.innerHTML = '<div class="status-icon">⚠️</div><div>Connection error. Please try again.</div>';
    els.status.style.display = 'flex';
  }
}

/* ── Search Input Events (single, clean block) ── */
let searchTimer, debounceTimer;

els.searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    clearTimeout(searchTimer);
    hideSuggestions();
    const q = e.target.value.trim();
    if (q) search(q);
  }
  if (e.key === 'Escape') hideSuggestions();
});

els.searchInput.addEventListener('input', e => {
  const q = e.target.value.trim();
  clearTimeout(searchTimer);
  clearTimeout(debounceTimer);

  if (q.length < 3) { hideSuggestions(); return; }

  // Show suggestions as user types
  getSuggestions(q).then(suggestions => showSuggestions(suggestions));

  // Prefetch search results in background
  debounceTimer = setTimeout(() => {
    fetch(`${API}/search?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(data => { if (data?.length) setCache('search_' + q, data, CACHE_TTL.search); })
      .catch(() => {});
  }, 400);

  // Auto-search after pause in typing
  searchTimer = setTimeout(() => { hideSuggestions(); search(q); }, 1200);
});

els.searchInput.addEventListener('blur', () => {
  // Small delay so mousedown on suggestion fires first
  setTimeout(hideSuggestions, 150);
});

/* ── Popstate ── */
window.addEventListener('popstate', e => {
  if (panelOpen) { closeNowPlaying(); return; }
  const q = e.state?.q || new URL(location.href).searchParams.get('q');
  if (q) search(q, false);
  else { showHome(); history.replaceState(null, '', location.pathname); }
});

(() => {
  const q = new URL(location.href).searchParams.get('q');
  if (q) search(q, false);
  else initHome();
})();

/* ── Daily Refresh ── */
function setupDailyRefresh() {
  setInterval(() => {
    const now = new Date();
    if (now.getHours() >= 1) {
      const todayStr = now.toDateString();
      const lastRefreshDate = localStorage.getItem('last_refresh_date');
      if (lastRefreshDate !== todayStr) {
        localStorage.setItem('last_refresh_date', todayStr);
        initHome();
      }
    }
  }, 60000);
}
setupDailyRefresh();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

/* ── Media Session ── */
function updateMediaSession(item) {
  if (!('mediaSession' in navigator)) return;
  const { title, artist } = parseTitleArtist(item.title || '');
  navigator.mediaSession.metadata = new MediaMetadata({
    title: title || item.title,
    artist: artist || 'Raaga',
    artwork: [{ src: hdThumb(item.thumbnail), sizes: '512x512', type: 'image/jpeg' }]
  });
  navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  navigator.mediaSession.setActionHandler('play', () => { ytPlayer?.playVideo(); });
  navigator.mediaSession.setActionHandler('pause', () => { ytPlayer?.pauseVideo(); });
  navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
  navigator.mediaSession.setActionHandler('previoustrack', () => playPrev());
  try {
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined && ytPlayer?.seekTo) {
        ytPlayer.seekTo(details.seekTime, true);
        updateProgressUI();
      }
    });
  } catch (e) {}
}

/* ── Disable Pull-to-Refresh ── */
let _pullStartY = 0;
document.addEventListener('touchstart', e => { _pullStartY = e.touches[0].clientY; }, { passive: true });
document.addEventListener('touchmove', e => {
  const pullingDown = e.touches[0].clientY > _pullStartY;
  if (e.target.closest('.np-overlay')) { if (pullingDown) e.preventDefault(); return; }
  if (e.target.closest('#player-bar')) { if (pullingDown) e.preventDefault(); return; }
  const atTop = els.main.scrollTop === 0;
  if (atTop && pullingDown) e.preventDefault();
}, { passive: false });

/* ── Background Playback Keepalive ── */
let _wasPlayingBeforeHidden = false;
let _silentCtx = null;

function ensureSilentAudio() {
  if (_silentCtx) return;
  try {
    _silentCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = _silentCtx.createOscillator();
    const gain = _silentCtx.createGain();
    gain.gain.value = 0;
    osc.connect(gain); gain.connect(_silentCtx.destination);
    osc.start();
  } catch (e) {}
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    _wasPlayingBeforeHidden = isPlaying;
    if (isPlaying) {
      ensureSilentAudio();
      [100, 300, 600, 1000, 1500].forEach(delay => {
        setTimeout(() => {
          if (_wasPlayingBeforeHidden && ytPlayer?.getPlayerState) {
            const state = ytPlayer.getPlayerState();
            if (state === YT.PlayerState.PAUSED || state === YT.PlayerState.BUFFERING) {
              ytPlayer.playVideo();
            }
          }
        }, delay);
      });
    }
  } else {
    if (_silentCtx?.state === 'suspended') _silentCtx.resume().catch(() => {});
  }
});
