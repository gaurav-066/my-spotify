const API = 'https://new-youtube-o7cl.onrender.com';

// Update these with curated playlists or your previous queries
const HOME_SECTIONS = [
  { id: 'bollywood', title: '🎵 Bollywood Hot Hits', type: 'search', value: 'latest bollywood songs 2024 "Provided to YouTube"' },
  { id: 'classics', title: '📻 All Time Hindi Classics', type: 'search', value: 'best 90s hindi romantic songs "Provided to YouTube"' },
  { id: 'tseries', title: '🔥 Latest from T-Series', type: 'playlist', value: 'UUq-Fj5jknLsUf-MWSy4_brA' },
  { id: 'arijit', title: '🎤 Arijit Singh Essentials', type: 'search', value: 'arijit singh best songs "Provided to YouTube"' },
  { id: 'lofi', title: '☕ Chill Lofi Beats', type: 'playlist', value: 'UUSJ4gkVC6NrvII8umztf0Ow' }
];

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
          try{ duration = ytPlayer.getDuration(); updateTotLabel(); }catch(_){}
          startLoop();
        }
        if(e.data === S.PAUSED) { isPlaying = false; showPlayAll(); stopLoop(); }
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
function startLoop(){
  stopLoop();
  progTimer = setInterval(()=>{
    if(!ytPlayer?.getCurrentTime) return;
    const t = ytPlayer.getCurrentTime();
    if(!duration) try{ duration=ytPlayer.getDuration(); updateTotLabel(); }catch(_){}
    const pct = duration > 0 ? (t/duration)*100 : 0;
    els.progFill.style.width = pct+'%'; els.npProgFill.style.width = pct+'%';
    els.playerBar.style.setProperty('--mob-prog', pct+'%');
    const f = fmt(t);
    els.tCur.textContent = f; els.npTCur.textContent = f;
  }, 500);
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
        <img class="mcard-img" src="${escapeHTML(item.thumbnail||'')}" onerror="this.style.opacity=0" alt=""/>
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
  try {
    const endpoint = sec.type === 'playlist' ? `${API}/playlist?id=${sec.value}` : `${API}/search?q=${encodeURIComponent(sec.value)}`;
    const res = await fetch(endpoint);
    const data = await res.json();
    if(data?.length) populateSection(sec, data);
    else document.getElementById(`scr-${sec.id}`).innerHTML='<span style="color:var(--text-muted);font-size:.85rem;padding:.5rem 0;display:block">Nothing found</span>';
  } catch {
    document.getElementById(`scr-${sec.id}`).innerHTML='<span style="color:var(--text-muted);font-size:.85rem;padding:.5rem 0;display:block">Couldn\'t load</span>';
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

  els.pThumb.src = item.thumbnail || '';
  els.pTitle.textContent = title || item.title;
  els.pArtist.textContent = artist;
  
  if(els.npSongTitle) els.npSongTitle.textContent = title || item.title;
  if(els.npSongArtist) els.npSongArtist.textContent = artist;
  if(els.npArtCover) els.npArtCover.src = item.thumbnail || '';
  if(els.npBgImg) els.npBgImg.src = item.thumbnail || '';

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
function setVideoMode(on){
  videoMode = on;
  const ytFrame = document.getElementById('yt-player-frame');
  const customControls = document.querySelector('.np-bottom');
  const customFsBtn = document.getElementById('np-fs-btn');

  if(on){
    els.npArtWrap.classList.add('video-mode');
    els.vidLabel.textContent='Switch to Audio';
    els.vidIconVideo.style.display='none'; els.vidIconAudio.style.display='';
    els.vidToggleBtn.classList.add('on');
    
    ytFrame.style.pointerEvents = 'auto'; 
    customControls.style.display = 'none'; 
    if(customFsBtn) customFsBtn.style.display = 'none'; 
  } else {
    els.npArtWrap.classList.remove('video-mode');
    els.vidLabel.textContent='Switch to Video';
    els.vidIconVideo.style.display=''; els.vidIconAudio.style.display='none';
    els.vidToggleBtn.classList.remove('on');
    
    ytFrame.style.pointerEvents = 'none'; 
    customControls.style.display = 'flex'; 
    if(customFsBtn) customFsBtn.style.display = 'flex'; 
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

let _nsy=0, _nsx=0;
document.querySelector('.np-panel').addEventListener('touchstart',e=>{
  _nsy=e.touches[0].clientY;
  _nsx=e.touches[0].clientX;
},{passive:true});
document.querySelector('.np-panel').addEventListener('touchend',e=>{
  const dy = e.changedTouches[0].clientY - _nsy;
  const dx = e.changedTouches[0].clientX - _nsx;
  if(dy > 60 && Math.abs(dx) < 40 && !isFullscreen && !videoMode){
    closeNowPlaying();
  } else if (dy > 120 && Math.abs(dx) < 40 && !isFullscreen && videoMode) {
    closeNowPlaying();
  }
},{passive:true});

els.vidToggleBtn.addEventListener('click', e=>{ e.stopPropagation(); setVideoMode(!videoMode); });

/* ── Fullscreen Toggle ── */
const npFsBtn = document.getElementById('np-fs-btn');
let isFullscreen = false;

async function toggleFullscreen(){
  isFullscreen = !isFullscreen;
  els.npOverlay.classList.toggle('fullscreen', isFullscreen);
  try{
    if(isFullscreen){
      const p = els.npOverlay.requestFullscreen?.() ?? els.npOverlay.webkitRequestFullscreen?.();
      if(p?.then){
        await p.then(()=>{
          if(videoMode && screen.orientation && screen.orientation.lock){
            screen.orientation.lock('landscape').catch(()=>{});
          }
        }).catch(()=>{});
      }
    } else {
      if(document.fullscreenElement) await document.exitFullscreen?.();
      if(screen.orientation && screen.orientation.unlock){
        screen.orientation.unlock();
      }
    }
  } catch(e){}
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
  els.status.innerHTML='<div class="status-icon">⏳</div><div>Loading…</div>';
  els.status.style.display='flex';
  els.secHeader.style.display='none';
  tracks=[]; currentIdx=-1; queueEl=els.results;
  
  try{
    let endpoint = '';
    let displayTitle = '';

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
      } else {
        endpoint = `${API}/search?q=${encodeURIComponent(q)}`;
        displayTitle = `Results for "${q}"`;
      }
    } else {
      endpoint = `${API}/search?q=${encodeURIComponent(q)}`;
      displayTitle = `Results for "${q}"`;
    }

    const res=await fetch(endpoint);
    const data=await res.json();
    
    els.status.style.display='none';
    if(!data?.length){
      els.status.innerHTML='<div class="status-icon">🎵</div><div>No results found.</div>';
      els.status.style.display='flex'; return;
    }
    
    tracks=data;
    els.secHeader.style.display='';
    els.secTitle.textContent = displayTitle;
    
    data.forEach((item,i)=>{
      const {title,artist} = parseTitleArtist(item.title||'');
      const row=document.createElement('div');
      row.className='trow';
      row.style.animationDelay=`${i*0.028}s`;
      row.innerHTML=`
        <div class="tnum"><span class="n">${i+1}</span><span class="pb">▶</span></div>
        <img class="tthumb" src="${escapeHTML(item.thumbnail||'')}" onerror="this.style.opacity=0" alt=""/>
        <div class="tinfo">
          <div class="ttitle">${escapeHTML(title)}</div>
          ${artist ? `<div class="tartist">${escapeHTML(artist)}</div>` : ''}
        </div>
        <div class="eq"><div class="eqb"></div><div class="eqb"></div><div class="eqb"></div></div>`;
      row.addEventListener('click', ()=>{ tracks=data; playFromRow(item,row,i); });
      els.results.appendChild(row);
    });
  }catch{
    els.status.innerHTML='<div class="status-icon">⚠️</div><div>Connection error. Please try again.</div>';
    els.status.style.display='flex';
  }
}

els.searchInput.addEventListener('keydown', e=>{
  if(e.key==='Enter'){ const q = e.target.value.trim(); if(q) search(q); }
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
    artwork: [{ src: item.thumbnail, sizes: '512x512', type: 'image/jpeg' }]
  });
  navigator.mediaSession.setActionHandler('play', () => ytPlayer?.playVideo());
  navigator.mediaSession.setActionHandler('pause', () => ytPlayer?.pauseVideo());
  navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
  navigator.mediaSession.setActionHandler('previoustrack', () => playPrev());
}
// ── Disable Pull-to-Refresh (only on main scroll, not panels) ──
let _pullStartY = 0;

document.addEventListener('touchstart', e => {
  _pullStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchmove', e => {
  // Don't interfere with player bar or now-playing panel swipes
  if (e.target.closest('#player-bar, .np-panel, .np-overlay')) return;

  const scrollEl = els.main; // your main scrollable div
  const atTop = scrollEl.scrollTop === 0;
  const pullingDown = e.touches[0].clientY > _pullStartY;

  if (atTop && pullingDown) {
    e.preventDefault(); // block pull-to-refresh only
  }
}, { passive: false });

