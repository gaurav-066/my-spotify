const API = 'https://wild-cherry-b868.samtesting67.workers.dev';

// Update these with curated playlists or your previous queries
const HOME_SECTIONS = [
  { id: 'bollywood', title: '🎵 Bollywood Hot Hits', type: 'search', value: 'latest bollywood songs 2024 "Provided to YouTube"' },
  { id: 'classics', title: '📻 All Time Hindi Classics', type: 'search', value: 'best 90s hindi romantic songs "Provided to YouTube"' },
  { id: 'tseries', title: '🔥 Latest from T-Series', type: 'playlist', value: 'UUq-Fj5jknLsUf-MWSy4_brA' },
  { id: 'international', title: '🎤 International Hits', type: 'search', value: 'international best songs "Provided to YouTube"' },
  { id: 'lofi', title: '☕ Chill Lofi Beats', type: 'playlist', value: 'UUSJ4gkVC6NrvII8umztf0Ow' }
];

/* ── Smart Cache ── */
const CACHE_TTL = {
  search: 12 * 60 * 60 * 1000,   // 12 hours
  playlist: 24 * 60 * 60 * 1000  // 24 hours
};

function getCached(key) {
  try {
    const raw = localStorage.getItem('rc_' + key);
    if (!raw) return null;
    const { data, ts, ttl } = JSON.parse(raw);
    // Return data even if expired — we'll refresh in background
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
  mobHome: document.getElementById('mob-home'),
  mobSearch: document.getElementById('mob-search'),
  viewHome: document.getElementById('view-home'),
  viewSearch: document.getElementById('view-search'),
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
  return String(str).replace(/[&<>'"]/g, match => {
    return {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[match];
  });
}

/* ── Thumbnail quality upgrade ── */
function hdThumb(url) {
  if (!url) return '';
  // Upgrade YouTube thumbnails to high quality
  // default.jpg (120x90) / mqdefault.jpg (320x180) → hqdefault.jpg (480x360)
  return url.replace(/\/(default|mqdefault|sddefault)\.(jpg|webp)/, '/hqdefault.$2');
}

/* ── YT IFrame API ── */
window.onYouTubeIframeAPIReady = () => {
  ytReady = true;
  ytPlayer = new YT.Player('yt-player-frame', {
    width: '100%', height: '100%',
    playerVars: { autoplay:0, playsinline:1, controls:1, rel:0, modestbranding:1 },
    events: {
      onReady(e){ e.target.setVolume(currentVolume); },
      onStateChange(e){
        const S = YT.PlayerState;
        if(e.data === S.PLAYING){
          isPlaying = true; showPauseAll();
          if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
          try{ duration = ytPlayer.getDuration(); updateTotLabel(); }catch(_){}
          startLoop();
        }
        if(e.data === S.PAUSED) { 
          isPlaying = false; showPlayAll(); stopLoop(); 
          if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
        }
        if(e.data === S.ENDED)  { playNext(); }
      }
    }
  });
};

/* ── UI helpers ── */
function fmt(s){ s=Math.floor(s||0); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }

function showPlayAll(){
  els.playIcon.style.display=''; els.pauseIcon.style.display='none';
  els.npPlayIcon.style.display=''; els.npPauseIcon.style.display='none';
  const mobIcon = document.getElementById('mob-pp-btn');
  if(mobIcon) mobIcon.innerHTML = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
}

function showPauseAll(){
  els.playIcon.style.display='none'; els.pauseIcon.style.display='';
  els.npPlayIcon.style.display='none'; els.npPauseIcon.style.display='';
  const mobIcon = document.getElementById('mob-pp-btn');
  if(mobIcon) mobIcon.innerHTML = `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
}

function updateTotLabel(){
  const d = fmt(duration);
  els.tTot.textContent = d; 
  els.npTTot.textContent = d;
}

function setNav(v){
  if(els.navHome) els.navHome.classList.toggle('active', v==='home');
  if(els.navSearch) els.navSearch.classList.toggle('active', v==='search');
  if(els.mobHome) els.mobHome.classList.toggle('active', v==='home');
  if(els.mobSearch) els.mobSearch.classList.toggle('active', v==='search');
}

function showHome(){
  els.viewHome.style.display='';
  els.viewSearch.style.display='none';
  setNav('home');
  els.main.scrollTo({top:0, behavior:'smooth'});
  // Clean the ?q= from URL when going home
  if(new URL(location.href).searchParams.get('q')){
    history.pushState({page:'home'}, '', location.pathname);
  }
  // If home body is empty (app started on search), load it now
  if(!els.homeBody.children.length) initHome();
}

function showSearch(){
  els.viewHome.style.display='none';
  els.viewSearch.style.display='';
  setNav('search');
  setTimeout(() => els.searchInput.focus(), 80);
}

/* ── Progress loop ── */
function updateProgressUI(){
  if(!ytPlayer?.getCurrentTime) return;
  const t = ytPlayer.getCurrentTime();
  // Double-check duration if it's still zero
  if(!duration || duration <= 0) {
    try { 
      const d = ytPlayer.getDuration(); 
      if(d > 0) {
        duration = d;
        updateTotLabel(); 
      }
    } catch(_){}
  }
  
  const pct = duration > 0 ? (t/duration)*100 : 0;
  
  // Update fillers
  if(els.progFill) els.progFill.style.width = pct+'%'; 
  if(els.npProgFill) els.npProgFill.style.width = pct+'%';
  if(els.playerBar) els.playerBar.style.setProperty('--mob-prog', pct+'%');
  
  // Update labels
  const f = fmt(t);
  if(els.tCur) els.tCur.textContent = f; 
  if(els.npTCur) els.npTCur.textContent = f;

  // Sync MediaSession position state for better lock screen & OS control sync
  if ('mediaSession' in navigator && navigator.mediaSession.setPositionState && duration > 0) {
    try {
      navigator.mediaSession.setPositionState({
        duration: duration,
        playbackRate: 1.0,
        position: Math.min(t, duration)
      });
    } catch(e) {}
  }
}

function startLoop(){
  stopLoop();
  updateProgressUI(); // Run once immediately
  progTimer = setInterval(updateProgressUI, 800);
}
function stopLoop(){ if(progTimer){ clearInterval(progTimer); progTimer=null; } }

/* ── Home sections ── */
function buildShimmerSection(sec){
  const block = document.createElement('div');
  block.className='sec-block'; block.id=`blk-${sec.id}`;
  block.innerHTML=`
    <div class="sec-head">
      <span class="sec-title">${escapeHTML(sec.title)}</span>
    </div>
    <div class="sec-scroll" id="scr-${sec.id}">
      ${Array(7).fill(0).map(()=>`
        <div class="mcard">
          <div class="mcard-art shimmer-art"></div>
          <div class="shimmer-line w80"></div>
          <div class="shimmer-line w55"></div>
        </div>`).join('')}
    </div>`;
  els.homeBody.appendChild(block);
}

function parseTitleArtist(raw){
  const p = raw.split(' - ');
  return p.length>1 ? {artist:p[0], title:p.slice(1).join(' - ')} : {artist:'', title:raw};
}

function populateSection(sec, items){
  const scrollEl = document.getElementById(`scr-${sec.id}`);
  if(!scrollEl) return;
  scrollEl.innerHTML='';
  items.forEach((item, i)=>{
    const {title, artist} = parseTitleArtist(item.title||'');
    const card = document.createElement('div');
    card.className='mcard';
    card.innerHTML=`
      <div class="mcard-art">
        <img class="mcard-img" src="${escapeHTML(hdThumb(item.thumbnail))}" onerror="this.style.opacity=0" alt=""/>
        <div class="mcard-overlay"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
      </div>
      <div class="mcard-title">${escapeHTML(title)}</div>
      <div class="mcard-artist">${escapeHTML(artist)}</div>`;
    card.addEventListener('click', ()=>{ tracks = items; playFromSection(items, i, card, scrollEl); });
    scrollEl.appendChild(card);
  });
}

async function loadSection(sec, delay){
  await new Promise(r => setTimeout(r, delay));
  const cacheKey = `${sec.type}_${sec.value}`;
  const ttl = CACHE_TTL[sec.type] || CACHE_TTL.search;
  const cached = getCached(cacheKey);

  // Show cached data instantly — no shimmer, no wait
  if (cached) {
    populateSection(sec, cached.data);
    // If not expired, we're done
    if (!cached.expired) return;
    // If expired, silently fetch fresh data in background
    try {
      const endpoint = sec.type === 'playlist'
        ? `${API}/playlist?id=${sec.value}`
        : `${API}/search?q=${encodeURIComponent(sec.value)}`;
      const res = await fetch(endpoint);
      const data = await res.json();
      if (data?.length) {
        setCache(cacheKey, data, ttl);
        populateSection(sec, data); // silently update UI
      }
    } catch {} // fail silently, cached version stays
    return;
  }

  // No cache — fetch normally with shimmer already showing
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
    // Show cached (even expired) as fallback if fetch fails
    const fallback = getCached(cacheKey);
    if (fallback) populateSection(sec, fallback.data);
    else document.getElementById(`scr-${sec.id}`).innerHTML =
      '<span style="color:var(--text-muted);font-size:.85rem;padding:.5rem 0;display:block">Couldn\'t load</span>';
  }
}

function initHome(){
  els.homeBody.innerHTML='';
  const h=new Date().getHours();
  const greet=h<5?'Late Night 🌙':h<12?'Good Morning ☀️':h<17?'Good Afternoon 🌤️':h<21?'Good Evening 🌙':'Good Night ✨';
  if(els.homeGreeting) els.homeGreeting.textContent=greet;
  HOME_SECTIONS.forEach((sec,i)=>{ buildShimmerSection(sec); loadSection(sec, i*250); });
}

/* ── Playback Logic ── */
function setActive(el){
  if(activeEl) activeEl.classList.remove('playing');
  activeEl=el; if(el) el.classList.add('playing');
}
function playFromSection(items, idx, cardEl, containerEl){
  setActive(cardEl); currentIdx=idx; queueEl=containerEl; playItem(items[idx]);
}
function playFromRow(item, rowEl, idx){
  setActive(rowEl); currentIdx=idx; queueEl=els.results; playItem(item);
}

async function playItem(item) {
  currentItem = item;
  updateMediaSession(item);
  const {title, artist} = parseTitleArtist(item.title || '');

  // Reset to audio mode on every new track
  if (videoMode) setVideoMode(false);

  els.pThumb.src = hdThumb(item.thumbnail);
  els.pTitle.textContent = title || item.title;
  els.pArtist.textContent = artist;
  
  if(els.npSongTitle) els.npSongTitle.textContent = title || item.title;
  if(els.npSongArtist) els.npSongArtist.textContent = artist;

  // Set album art with graceful error handling
  if(els.npArtCover) {
    els.npArtCover.style.opacity = '1';
    els.npArtCover.onerror = () => { els.npArtCover.style.opacity = '0'; };
    els.npArtCover.src = hdThumb(item.thumbnail);
  }
  if(els.npBgImg) {
    els.npBgImg.onerror = () => { els.npBgImg.style.opacity = '0'; };
    els.npBgImg.src = hdThumb(item.thumbnail);
  }

  // Reset progress
  duration = 0;
  els.progFill.style.width = '0%';
  els.npProgFill.style.width = '0%';
  els.tCur.textContent = '0:00';
  els.tTot.textContent = '0:00';
  els.npTCur.textContent = '0:00';
  els.npTTot.textContent = '0:00';

  openNowPlaying();
  showPauseAll();

  if (ytPlayer && ytReady) {
    ytPlayer.loadVideoById({ videoId: item.videoId });
  } else {
    const t = setInterval(() => {
      if (ytReady && ytPlayer) {
        clearInterval(t);
        ytPlayer.loadVideoById({ videoId: item.videoId });
      }
    }, 100);
  }
}
  
function playNext(){
  if(currentIdx >= tracks.length-1) return;
  currentIdx++;
  const item = tracks[currentIdx];
  if(queueEl){ const el = queueEl.children[currentIdx]; setActive(el||null); if(el) el.scrollIntoView({behavior:'smooth',block:'nearest'}); }
  playItem(item);
}
function playPrev(){
  if(currentIdx <= 0) return;
  currentIdx--;
  const item = tracks[currentIdx];
  if(queueEl){ const el = queueEl.children[currentIdx]; setActive(el||null); if(el) el.scrollIntoView({behavior:'smooth',block:'nearest'}); }
  playItem(item);
}

/* ── Video / audio mode override ── */
function setVideoMode(on) {
  videoMode = on;
  const ytFrame = document.getElementById('yt-player-frame');
  const customControls = document.querySelector('.np-bottom');
  const customFsBtn = document.getElementById('np-fs-btn');

  if (on) {
    // VIDEO MODE
    els.npArtWrap.classList.add('video-mode');
    els.vidLabel.textContent = 'Switch to Audio';
    els.vidIconVideo.style.display = 'none';
    els.vidIconAudio.style.display = '';
    els.vidToggleBtn.classList.add('on');
    ytFrame.style.pointerEvents = 'auto';
    customControls.style.display = 'none';
    if (customFsBtn) customFsBtn.style.display = 'flex';
    // Hide cover art so YouTube iframe is visible
    if (els.npArtCover) els.npArtCover.style.opacity = '0';
  } else {
    // AUDIO MODE
    els.npArtWrap.classList.remove('video-mode');
    els.vidLabel.textContent = 'Switch to Video';
    els.vidIconVideo.style.display = '';
    els.vidIconAudio.style.display = 'none';
    els.vidToggleBtn.classList.remove('on');
    ytFrame.style.pointerEvents = 'none';
    customControls.style.display = 'flex';
    if (customFsBtn) customFsBtn.style.display = 'none';
    // Show cover art again
    if (els.npArtCover) els.npArtCover.style.opacity = '1';
  }
}

/* ── UI Panel Controls ── */
function openNowPlaying(){
  if(!panelOpen) history.pushState({panel:'nowplaying'}, '');
  panelOpen=true;
  els.npOverlay.classList.add('open');
}
function closeNowPlaying(){ panelOpen=false; els.npOverlay.classList.remove('open'); }

/* ── Events ── */
// Navigation binds
if(els.navHome) els.navHome.addEventListener('click', showHome);
if(els.navSearch) els.navSearch.addEventListener('click', showSearch);
if(els.mobHome) els.mobHome.addEventListener('click', showHome);
if(els.mobSearch) els.mobSearch.addEventListener('click', showSearch);

// Player controls bind
const handlePP = e => { e.stopPropagation(); if(!ytPlayer) return; isPlaying?ytPlayer.pauseVideo():ytPlayer.playVideo(); };
els.ppBtn.addEventListener('click', handlePP);
els.npPpBtn.addEventListener('click', handlePP);
const mobPpBtn = document.getElementById('mob-pp-btn');
if (mobPpBtn) mobPpBtn.addEventListener('click', handlePP);
els.nextBtn.addEventListener('click', e=>{ e.stopPropagation(); playNext(); });
els.prevBtn.addEventListener('click', e=>{ e.stopPropagation(); playPrev(); });
els.npNextBtn.addEventListener('click', e=>{ e.stopPropagation(); playNext(); });
els.npPrevBtn.addEventListener('click', e=>{ e.stopPropagation(); playPrev(); });

els.progBar.addEventListener('click', e=>{
  if(!ytPlayer||!duration) return;
  const r=els.progBar.getBoundingClientRect();
  ytPlayer.seekTo(((e.clientX-r.left)/r.width)*duration,true);
});
els.npProgBar.addEventListener('click', e=>{
  if(!ytPlayer||!duration) return;
  const r=els.npProgBar.getBoundingClientRect();
  ytPlayer.seekTo(((e.clientX-r.left)/r.width)*duration,true);
});

els.volBar.addEventListener('click', e=>{
  const r=els.volBar.getBoundingClientRect();
  currentVolume=Math.round(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*100);
  els.volFill.style.width=currentVolume+'%';
  if(ytPlayer?.setVolume) ytPlayer.setVolume(currentVolume);
});

els.playerBar.addEventListener('click', e=>{
  if(e.target.closest('button,.prog-bar,.vol-bar')) return;
  if(currentItem) openNowPlaying();
});

// Mobile Player interactions
let _sy=0;
els.playerBar.addEventListener('touchstart',e=>{_sy=e.touches[0].clientY;},{passive:true});
els.playerBar.addEventListener('touchend',e=>{if(_sy-e.changedTouches[0].clientY>30&&currentItem)openNowPlaying();},{passive:true});

/* ── Spotify-style drag-to-close ── */
let _nsy=0, _nsx=0, _npDragging=false, _npDragStartTime=0;
const npPanelEl = document.querySelector('.np-panel');

npPanelEl.addEventListener('touchstart', e=>{
  _nsy=e.touches[0].clientY;
  _nsx=e.touches[0].clientX;
  _npDragging=false;
  _npDragStartTime=Date.now();
  // Disable CSS transitions so panel follows finger directly
  npPanelEl.style.transition='none';
  els.npOverlay.style.transition='none';
},{passive:true});

npPanelEl.addEventListener('touchmove', e=>{
  if(isFullscreen) return;
  const dy=e.touches[0].clientY-_nsy;
  const dx=e.touches[0].clientX-_nsx;
  // Only track downward drags that are clearly vertical
  if(dy<=5 || Math.abs(dx)>Math.abs(dy)*1.5) return;
  _npDragging=true;
  // Panel follows finger with a slight ease near max drag
  npPanelEl.style.transform=`translateY(${Math.min(dy, window.innerHeight*0.9)}px)`;
  // Backdrop fades as you drag down
  const alpha=Math.max(0, 1-dy/(window.innerHeight*0.55));
  els.npOverlay.style.opacity=String(alpha);
},{passive:true});

npPanelEl.addEventListener('touchend', e=>{
  // Restore CSS transitions
  if(!_npDragging){
    npPanelEl.style.transition='';
    els.npOverlay.style.transition='';
    return;
  }
  _npDragging=false;
  const dy=e.changedTouches[0].clientY-_nsy;
  const elapsed=Math.max(1, Date.now()-_npDragStartTime);
  const velocity=dy/elapsed; // px/ms — quick flick = high velocity
  const threshold=videoMode?140:80;

  if(dy>threshold || velocity>0.7){
    // Dismiss — animate out, then close
    npPanelEl.style.transition='transform 0.38s cubic-bezier(0.32,0.72,0,1)';
    els.npOverlay.style.transition='opacity 0.38s ease';
    npPanelEl.style.transform='translateY(100vh)';
    els.npOverlay.style.opacity='0';
    setTimeout(()=>{
      panelOpen=false;
      els.npOverlay.classList.remove('open');
      npPanelEl.style.transform='';
      npPanelEl.style.transition='';
      els.npOverlay.style.opacity='';
      els.npOverlay.style.transition='';
    },400);
  } else {
    // Not far/fast enough — snap back
    npPanelEl.style.transition='transform 0.4s cubic-bezier(0.32,0.72,0,1)';
    els.npOverlay.style.transition='opacity 0.4s ease';
    npPanelEl.style.transform='translateY(0)';
    els.npOverlay.style.opacity='1';
    setTimeout(()=>{
      npPanelEl.style.transform='';
      npPanelEl.style.transition='';
      els.npOverlay.style.opacity='';
      els.npOverlay.style.transition='';
    },420);
  }
},{passive:true});

els.vidToggleBtn.addEventListener('click', e=>{ e.stopPropagation(); setVideoMode(!videoMode); });

/* ── Fullscreen Toggle ── */
const npFsBtn = document.getElementById('np-fs-btn');
let isFullscreen = false;

async function toggleFullscreen() {
  isFullscreen = !isFullscreen;
  els.npOverlay.classList.toggle('fullscreen', isFullscreen);

  try {
    if (isFullscreen) {
      if (videoMode) {
        // In video mode — go fullscreen directly on the YT iframe (1 click!)
        const ytIframe = document.querySelector('#yt-player-frame iframe');
        const target = ytIframe || els.npArtWrap;
        const p = target.requestFullscreen?.() ?? target.webkitRequestFullscreen?.();
        if (p?.catch) p.catch(() => {});
        // Lock to landscape for video
        if (screen.orientation?.lock) {
          screen.orientation.lock('landscape').catch(() => {});
        }
      } else {
        // In audio mode — fullscreen the whole overlay (album art view)
        const p = els.npOverlay.requestFullscreen?.() ?? els.npOverlay.webkitRequestFullscreen?.();
        if (p?.catch) p.catch(() => {});
      }
    } else {
      if (document.fullscreenElement) await document.exitFullscreen?.();
      if (screen.orientation?.unlock) screen.orientation.unlock();
    }
  } catch (e) {}
}

if(npFsBtn) npFsBtn.addEventListener('click', e=>{ e.stopPropagation(); toggleFullscreen(); });
document.addEventListener('fullscreenchange', ()=>{
  if(!document.fullscreenElement && isFullscreen){
    isFullscreen=false;
    els.npOverlay.classList.remove('fullscreen');
    if(screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
  }
});

els.npBackdrop.addEventListener('click', closeNowPlaying);
els.npCloseBtn.addEventListener('click', ()=>{ if(isFullscreen) toggleFullscreen(); else closeNowPlaying(); });
document.addEventListener('keydown', e=>{
  if(e.key==='Escape'){
    if(isFullscreen){ isFullscreen=false; els.npOverlay.classList.remove('fullscreen'); }
    else if(panelOpen) closeNowPlaying();
  }
});

/* ── Master Search ── */
async function search(q, pushState=true){
  if(!q.trim()) return;
  if(pushState){
    const u=new URL(location.href);
    u.searchParams.set('q',q);
    history.pushState({q},'',u);
  }
  showSearch();
  els.searchInput.value=q;
  els.results.innerHTML='';
 els.status.style.display = 'none';
els.secHeader.style.display = 'none';
els.results.innerHTML = Array(8).fill(0).map(() => `
  <div class="skel-row">
    <div class="skel-thumb"></div>
    <div class="skel-info">
      <div class="skel-title"></div>
      <div class="skel-artist"></div>
    </div>
  </div>
`).join('');
  tracks=[]; currentIdx=-1; queueEl=els.results;
  
try {
  let endpoint = '';
  let displayTitle = '';
  let cacheKey = '';

  if (q.includes('list=')) {
    let playlistId = '';
    try {
      const parsedUrl = new URL(q);
      playlistId = parsedUrl.searchParams.get('list');
    } catch(e) {
      const match = q.match(/list=([a-zA-Z0-9_-]+)/);
      if(match) playlistId = match[1];
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

  // Check cache first
  const cached = typeof getCached === 'function' ? getCached(cacheKey) : null;
  let data = cached?.data || null;

  if (!data) {
    // No cache — fetch fresh
    const res = await fetch(endpoint);
    data = await res.json();
    if (data?.length) setCache(cacheKey, data, CACHE_TTL.search);
  } else if (cached.expired) {
    // Show cached instantly, refresh in background
    fetch(endpoint).then(r => r.json())
      .then(fresh => { if(fresh?.length) setCache(cacheKey, fresh, CACHE_TTL.search); })
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
    const {title, artist} = parseTitleArtist(item.title || '');
    const row = document.createElement('div');
    row.className = 'trow';
    row.style.animationDelay = `${i * 0.028}s`;
    row.innerHTML = `
      <div class="tnum"><span class="n">${i+1}</span><span class="pb">▶</span></div>
      <img class="tthumb" src="${escapeHTML(hdThumb(item.thumbnail||''))}" onerror="this.style.opacity=0" alt=""/>
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

let searchTimer;
els.searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    if (q) search(q);
  }
});

els.searchInput.addEventListener('input', e => {
  const q = e.target.value.trim();
  clearTimeout(searchTimer);
  if (q.length < 3) return; // don't fire for 1-2 chars
  searchTimer = setTimeout(() => search(q), 500); // fire 500ms after typing stops
});

// ── Prefetch on keystroke ──
let debounceTimer;
els.searchInput.addEventListener('input', e => {
  const q = e.target.value.trim();
  clearTimeout(debounceTimer);
  if (q.length >= 3) {
    debounceTimer = setTimeout(() => {
      fetch(`${API}/search?q=${encodeURIComponent(q)}`)
        .then(r => r.json())
        .then(data => { if(data?.length) setCache('search_' + q, data, CACHE_TTL.search); })
        .catch(() => {});
    }, 400);
  }
});

window.addEventListener('popstate', e=>{
  // Back button while Now Playing is open → just close the panel
  if(panelOpen){ closeNowPlaying(); return; }
  const q = e.state?.q || new URL(location.href).searchParams.get('q');
  if(q) search(q, false);
  else { showHome(); history.replaceState(null,'', location.pathname); }
});

(()=>{
  const q = new URL(location.href).searchParams.get('q');
  if(q) search(q, false);
  else initHome();
})();

/* ── 1:00 AM Daily Refresh ── */
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
  
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js').catch(()=>{});
}

// ── MEDIA SESSION (Background Audio) ──
function updateMediaSession(item) {
  if (!('mediaSession' in navigator)) return;
  const { title, artist } = parseTitleArtist(item.title || '');
  navigator.mediaSession.metadata = new MediaMetadata({
    title: title || item.title,
    artist: artist || 'Raaga',
    artwork: [{ src: hdThumb(item.thumbnail), sizes: '512x512', type: 'image/jpeg' }]
  });
  
  // Update initial playback state
  navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

  navigator.mediaSession.setActionHandler('play', () => { ytPlayer?.playVideo(); });
  navigator.mediaSession.setActionHandler('pause', () => { ytPlayer?.pauseVideo(); });
  navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
  navigator.mediaSession.setActionHandler('previoustrack', () => playPrev());
  
  // Support seeking from lock screen
  try {
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined && ytPlayer?.seekTo) {
        ytPlayer.seekTo(details.seekTime, true);
        updateProgressUI();
      }
    });
  } catch(e) {}
}
// ── Disable Pull-to-Refresh (only on main scroll, not panels) ──
let _pullStartY = 0;

document.addEventListener('touchstart', e => {
  _pullStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchmove', e => {
  const pullingDown = e.touches[0].clientY > _pullStartY;

  // Block pull-to-refresh inside the now-playing overlay (PTR was leaking through here)
  // The swipe-down-to-close gesture is handled on touchend so preventDefault here is safe
  if (e.target.closest('.np-overlay')) {
    if (pullingDown) e.preventDefault();
    return;
  }

  // Block pull-to-refresh on the floating player pill
  if (e.target.closest('#player-bar')) {
    if (pullingDown) e.preventDefault();
    return;
  }

  // Block pull-to-refresh on main content only when scrolled to top
  const scrollEl = els.main;
  const atTop = scrollEl.scrollTop === 0;
  if (atTop && pullingDown) {
    e.preventDefault();
  }
}, { passive: false });

// ── BACKGROUND PLAYBACK KEEPALIVE ──
// YouTube's iframe pauses when the screen locks (visibilitychange → hidden).
// We counter this by immediately resuming and keeping a silent audio context alive.

let _wasPlayingBeforeHidden = false;

// Silent AudioContext keeps the browser audio session active during screen-off
let _silentCtx = null;
function ensureSilentAudio() {
  if (_silentCtx) return;
  try {
    _silentCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Create a silent oscillator to keep the context alive
    const osc = _silentCtx.createOscillator();
    const gain = _silentCtx.createGain();
    gain.gain.value = 0; // completely silent
    osc.connect(gain);
    gain.connect(_silentCtx.destination);
    osc.start();
  } catch(e) {}
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Screen locked / tab hidden — remember if we were playing
    _wasPlayingBeforeHidden = isPlaying;
    if (isPlaying) {
      ensureSilentAudio();
      // YouTube will pause the video shortly; fight back with repeated resume attempts
      const resumeAttempts = [100, 300, 600, 1000, 1500];
      resumeAttempts.forEach(delay => {
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
    // Screen unlocked — resume the silent context if it was suspended
    if (_silentCtx && _silentCtx.state === 'suspended') {
      _silentCtx.resume().catch(() => {});
    }
  }
});