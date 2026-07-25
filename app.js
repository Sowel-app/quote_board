(function(){
  // ---------- Persistence ----------
  // Saves quotes + settings to localStorage so they survive reloads/new
  // tabs (e.g. when this runs as a New Tab override). Falls back silently
  // if storage isn't available (some sandboxed previews block it).
  const STORE_QUOTES_KEY = 'quoteboard_quotes_v1';
  const STORE_SETTINGS_KEY = 'quoteboard_settings_v1';

  function loadJSON(key, fallback){
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch(e){ return fallback; }
  }
  function saveJSON(key, value){
    try { localStorage.setItem(key, JSON.stringify(value)); } catch(e){ /* ignore */ }
  }
  function saveQuotes(){ saveJSON(STORE_QUOTES_KEY, quotes); }
  function saveSettings(){
    saveJSON(STORE_SETTINGS_KEY, {
      bgColor: bgColorValue,
      fontId: currentFontId,
      order,
      intervalSec,
      maxOnScreen
    });
  }

  const savedSettings = loadJSON(STORE_SETTINGS_KEY, {});

  // ---------- State ----------
  let quotes = loadJSON(STORE_QUOTES_KEY, []);
  let order = savedSettings.order || 'random';
  let intervalSec = savedSettings.intervalSec || 4;
  let maxOnScreen = savedSettings.maxOnScreen || 2;
  let bgColorValue = savedSettings.bgColor || '#EDE3D0';
  let currentFontId = savedSettings.fontId || 'fraunces';
  let seqIndex = 0;
  let lastRandomIndex = -1;
  let onScreenCount = 0;
  let spawnTimer = null;

  const board = document.getElementById('board');
  const layer = document.getElementById('quotes-layer');
  const emptyState = document.getElementById('empty-state');
  const menuToggle = document.getElementById('menu-toggle');
  const panel = document.getElementById('panel');
  const bgColor = document.getElementById('bg-color');
  const swatchesEl = document.getElementById('swatches');
  const quoteInput = document.getElementById('quote-input');
  const authorInput = document.getElementById('author-input');
  const addBtn = document.getElementById('add-btn');
  const quoteListEl = document.getElementById('quote-list');
  const countEl = document.getElementById('count');
  const intervalSlider = document.getElementById('interval-slider');
  const intervalValue = document.getElementById('interval-value');
  const decMax = document.getElementById('dec-max');
  const incMax = document.getElementById('inc-max');
  const maxCountEl = document.getElementById('max-count');
  const packRow = document.getElementById('pack-row');
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importFile = document.getElementById('import-file');
  const screensaverBtn = document.getElementById('screensaver-btn');
  const exitHint = document.getElementById('exit-screensaver-hint');
  const audioPlayer = document.getElementById('audio-player');
  const musicPlayBtn = document.getElementById('music-play');
  const musicVolume = document.getElementById('music-volume');
  const nowPlayingEl = document.getElementById('music-now-playing');
  const musicUploadBtn = document.getElementById('music-upload-btn');
  const musicUploadFile = document.getElementById('music-upload-file');
  const presetTrackListEl = document.getElementById('preset-track-list');
  const trackListEl = document.getElementById('track-list');
  const trackCountEl = document.getElementById('track-count');

  // ---------- Menu toggle ----------
  menuToggle.addEventListener('click', () => {
    panel.classList.toggle('open');
    menuToggle.classList.toggle('open');
  });

  // ---------- Background color ----------
  const presetColors = ['#EDE3D0', '#161821', '#F4F1EA', '#0E1F1C', '#2B2140', '#1B2A38', '#3A2418'];
  presetColors.forEach(c => {
    const sw = document.createElement('div');
    sw.className = 'swatch';
    sw.style.background = c;
    sw.addEventListener('click', () => setBg(c));
    swatchesEl.appendChild(sw);
  });
  function setBg(hex){
    board.style.backgroundColor = hex;
    bgColor.value = hex;
    bgColorValue = hex;
    saveSettings();
  }
  bgColor.addEventListener('input', (e) => setBg(e.target.value));
  setBg(bgColorValue);

  // ---------- Text color helper (contrast against board bg) ----------
  function hexToRgb(hex){
    const h = hex.replace('#','');
    const n = parseInt(h.length===3 ? h.split('').map(c=>c+c).join('') : h, 16);
    return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
  }
  function luminance(hex){
    const {r,g,b} = hexToRgb(hex);
    const a = [r,g,b].map(v=>{
      v/=255;
      return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4);
    });
    return 0.2126*a[0] + 0.7152*a[1] + 0.0722*a[2];
  }
  function textColorFor(hex){
    return luminance(hex) > 0.45 ? '#211D17' : '#F3F0EA';
  }

  // ---------- Font choice ----------
  const fontPresets = [
    { id: 'fraunces', label: 'Fraunces', preview: 'Aa', family: "'Fraunces', serif", style: 'italic', weight: 400, ls: '0.01em' },
    { id: 'playfair', label: 'Playfair', preview: 'Aa', family: "'Playfair Display', serif", style: 'italic', weight: 600, ls: '0em' },
    { id: 'caveat', label: 'Caveat', preview: 'Aa', family: "'Caveat', cursive", style: 'normal', weight: 600, ls: '0.01em' },
    { id: 'inter', label: 'Inter', preview: 'Aa', family: "'Inter', sans-serif", style: 'normal', weight: 500, ls: '0.005em' },
    { id: 'mono', label: 'Space Mono', preview: 'Aa', family: "'Space Mono', monospace", style: 'normal', weight: 700, ls: '-0.01em' },
  ];
  const fontGrid = document.getElementById('font-grid');
  fontPresets.forEach((f) => {
    const card = document.createElement('div');
    card.className = 'font-option' + (f.id === currentFontId ? ' active' : '');
    card.dataset.fontId = f.id;
    card.style.fontFamily = f.family;
    card.style.fontStyle = f.style;
    card.style.fontWeight = f.weight;
    card.innerHTML = `${f.preview}<span class="fo-label">${f.label}</span>`;
    card.addEventListener('click', () => setQuoteFont(f));
    fontGrid.appendChild(card);
  });
  function setQuoteFont(f){
    document.documentElement.style.setProperty('--quote-font-family', f.family);
    document.documentElement.style.setProperty('--quote-font-style', f.style);
    document.documentElement.style.setProperty('--quote-font-weight', f.weight);
    document.documentElement.style.setProperty('--quote-letter-spacing', f.ls);
    document.querySelectorAll('.font-option').forEach(el => {
      el.classList.toggle('active', el.dataset.fontId === f.id);
    });
    currentFontId = f.id;
    saveSettings();
  }
  setQuoteFont(fontPresets.find(f => f.id === currentFontId) || fontPresets[0]);

  // ---------- Quick packs ----------
  const quotePacks = {
    'Stoic': [
      { text: 'You have power over your mind — not outside events. Realize this, and you will find strength.', author: 'Marcus Aurelius' },
      { text: 'We suffer more in imagination than in reality.', author: 'Seneca' },
      { text: 'No man is free who is not master of himself.', author: 'Epictetus' }
    ],
    'Focus': [
      { text: 'Where focus goes, energy flows.', author: '' },
      { text: 'Starve your distractions, feed your focus.', author: '' },
      { text: 'One task at a time. That is the whole secret.', author: '' }
    ],
    'Grind': [
      { text: 'Discipline is the bridge between goals and accomplishment.', author: 'Jim Rohn' },
      { text: 'The pain of discipline weighs ounces; the pain of regret weighs tons.', author: '' },
      { text: 'Small steps every day beat big leaps once in a while.', author: '' }
    ],
    'Warmth': [
      { text: 'Be the reason someone believes in the goodness of people.', author: '' },
      { text: 'What you do with kindness always comes back around.', author: '' },
      { text: 'Home is wherever the people who love you are.', author: '' }
    ]
  };
  Object.keys(quotePacks).forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'pack-btn';
    btn.textContent = '+ ' + name;
    btn.addEventListener('click', () => {
      quotePacks[name].forEach(q => quotes.push({ ...q }));
      saveQuotes();
      renderList();
      ensureLoop();
    });
    packRow.appendChild(btn);
  });

  // ---------- Export / Import ----------
  exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(quotes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quotes.json';
    a.click();
    URL.revokeObjectURL(url);
  });
  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if(!Array.isArray(data)) throw new Error('Not an array');
        data.forEach(item => {
          if(typeof item === 'string'){
            quotes.push({ text: item, author: '' });
          } else if(item && typeof item.text === 'string'){
            quotes.push({ text: item.text, author: item.author || '' });
          }
        });
        renderList();
        ensureLoop();
        saveQuotes();
      } catch(err){
        alert('Could not read that file — expected a JSON list of quotes.');
      }
      importFile.value = '';
    };
    reader.readAsText(file);
  });

  // ---------- Screensaver mode ----------
  let wakeLock = null;
  async function requestWakeLock(){
    try {
      if('wakeLock' in navigator){
        wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch(err){ /* wake lock not available — fail silently */ }
  }
  function releaseWakeLock(){
    if(wakeLock){ wakeLock.release().catch(()=>{}); wakeLock = null; }
  }

  let hideHintTimer = null;
  function showExitHint(){
    exitHint.classList.add('show');
    clearTimeout(hideHintTimer);
    hideHintTimer = setTimeout(() => exitHint.classList.remove('show'), 3500);
  }

  let enteredAt = 0;
  function enterScreensaver(){
    enteredAt = Date.now();
    document.body.classList.add('screensaver-active');
    panel.classList.remove('open');
    menuToggle.classList.remove('open');
    if(document.documentElement.requestFullscreen){
      document.documentElement.requestFullscreen().catch(()=>{});
    }
    requestWakeLock();
    showExitHint();
  }
  function exitScreensaver(){
    document.body.classList.remove('screensaver-active');
    if(document.fullscreenElement && document.exitFullscreen){
      document.exitFullscreen().catch(()=>{});
    }
    releaseWakeLock();
    exitHint.classList.remove('show');
  }
  screensaverBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    enterScreensaver();
  });
  ['mousemove', 'touchstart', 'click', 'keydown'].forEach(evt => {
    document.addEventListener(evt, () => {
      if(document.body.classList.contains('screensaver-active') && Date.now() - enteredAt > 500){
        exitScreensaver();
      }
    }, { passive: true });
  });
  document.addEventListener('fullscreenchange', () => {
    if(!document.fullscreenElement){
      document.body.classList.remove('screensaver-active');
      releaseWakeLock();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'visible' && document.body.classList.contains('screensaver-active')){
      requestWakeLock();
    }
  });

  // ---------- PWA: service worker ----------
  if('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  // ---------- Music player ----------
  // "Suggested tracks" are just named slots. You paste a YouTube link once
  // per track (your choice of which official/legit upload to use) — after
  // that, clicking the name plays it right here via YouTube's own embedded
  // player. Nothing is downloaded, hosted, or reproduced by this app; the
  // audio streams directly from YouTube. The separate "Playlist" section
  // below is for your own local audio files.
  const presetTrackNames = [
    'Time Flows Ever Onward — Frieren',
    'Her — The American Dawn',
    'Hokage Funeral Theme',
    'Obito Theme',
    'Gaara Theme',
    'Samidare — Eliott Tordo',
    'Solace',
    'Floating in Reverie'
  ];
  const PRESET_LINKS_KEY = 'quoteboard_preset_links_v1';
  let presetLinks = {}; // name -> YouTube video id
  try {
    const saved = localStorage.getItem(PRESET_LINKS_KEY);
    if(saved) presetLinks = JSON.parse(saved);
  } catch(e){ /* storage unavailable in this context — links just won't persist */ }
  function savePresetLinks(){
    try { localStorage.setItem(PRESET_LINKS_KEY, JSON.stringify(presetLinks)); } catch(e){ /* ignore */ }
  }

  let tracks = []; // { id, name, url } — user-uploaded files only
  let trackIdCounter = 0;
  let currentTrackIndex = -1;
  let isPlaying = false;
  let currentSource = null; // { type: 'file', index } | { type: 'youtube', name }

  function extractYouTubeId(url){
    try {
      const u = new URL(url.trim());
      if(u.hostname.includes('youtu.be')) return u.pathname.slice(1) || null;
      if(u.searchParams.get('v')) return u.searchParams.get('v');
      const m = u.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/);
      if(m) return m[1];
    } catch(e){ /* not a valid URL */ }
    return null;
  }

  // ---- YouTube IFrame API (lazy-loaded on first use) ----
  let ytPlayer = null;
  let ytApiLoading = false;
  let ytReadyQueue = [];
  let ytFailed = (location.protocol === 'file:');
  function ensureYouTubeReady(callback){
    if(ytFailed){
      nowPlayingEl.textContent = location.protocol === 'file:'
        ? "YouTube playback needs a real web address — host this file (GitHub Pages/Netlify) or run a local server, not file://."
        : "Can't load YouTube player here — open the downloaded file in a real browser tab.";
      return;
    }
    if(ytPlayer){ callback(); return; }
    ytReadyQueue.push(callback);
    if(ytApiLoading) return;
    ytApiLoading = true;
    const failTimer = setTimeout(() => {
      if(!ytPlayer){
        ytFailed = true;
        nowPlayingEl.textContent = "Can't load YouTube player here — open the downloaded file in a real browser tab.";
      }
    }, 6000);
    window.onYouTubeIframeAPIReady = function(){
      clearTimeout(failTimer);
      ytPlayer = new YT.Player('yt-player', {
        height: '0', width: '0',
        playerVars: { autoplay: 0, controls: 0 },
        events: {
          onReady: () => { ytReadyQueue.forEach(cb => cb()); ytReadyQueue = []; },
          onStateChange: onYtStateChange
        }
      });
    };
    if(window.YT && window.YT.Player){
      window.onYouTubeIframeAPIReady();
    } else {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.onerror = () => {
        clearTimeout(failTimer);
        ytFailed = true;
        nowPlayingEl.textContent = "Can't load YouTube player here — open the downloaded file in a real browser tab.";
      };
      document.head.appendChild(tag);
    }
  }
  function onYtStateChange(e){
    if(e.data === YT.PlayerState.ENDED && currentSource && currentSource.type === 'youtube'){
      ytPlayer.seekTo(0);
      ytPlayer.playVideo(); // loop the ambient track
    }
    if(e.data === YT.PlayerState.PLAYING){ isPlaying = true; updatePlayButton(); }
    if(e.data === YT.PlayerState.PAUSED){ isPlaying = false; updatePlayButton(); }
  }

  function stopAllPlayback(){
    audioPlayer.pause();
    if(ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();
  }

  function promptForLink(name){
    const url = window.prompt(`Paste a YouTube link for "${name}":`, '');
    if(!url) return;
    const id = extractYouTubeId(url);
    if(!id){ alert("Couldn't find a video ID in that link — paste a full YouTube URL."); return; }
    presetLinks[name] = id;
    savePresetLinks();
    renderPresetList();
  }

  function playPreset(name){
    const id = presetLinks[name];
    if(!id) return;
    stopAllPlayback();
    currentSource = { type: 'youtube', name };
    nowPlayingEl.textContent = name;
    renderPresetList();
    renderTrackList();
    ensureYouTubeReady(() => {
      ytPlayer.loadVideoById(id);
      isPlaying = true;
      updatePlayButton();
    });
  }

  function renderPresetList(){
    presetTrackListEl.innerHTML = '';
    presetTrackNames.forEach((name) => {
      const linked = !!presetLinks[name];
      const li = document.createElement('li');
      if(linked && currentSource && currentSource.type === 'youtube' && currentSource.name === name){
        li.classList.add('playing');
      }
      const nameSpan = document.createElement('span');
      nameSpan.className = 't-name';
      nameSpan.textContent = name;
      if(linked){
        nameSpan.style.cursor = 'pointer';
        nameSpan.addEventListener('click', () => playPreset(name));
      }

      const links = document.createElement('span');
      links.className = 't-links';
      const actionBtn = document.createElement('button');
      actionBtn.className = 't-link';
      actionBtn.textContent = linked ? 'Relink' : 'Paste YouTube link';
      actionBtn.addEventListener('click', () => promptForLink(name));
      links.appendChild(actionBtn);

      li.appendChild(nameSpan);
      li.appendChild(links);
      presetTrackListEl.appendChild(li);
    });
  }

  function renderTrackList(){
    trackCountEl.textContent = tracks.length;
    trackListEl.innerHTML = '';
    if(tracks.length === 0){
      const empty = document.createElement('div');
      empty.className = 'empty-list';
      empty.textContent = 'No tracks yet';
      trackListEl.appendChild(empty);
      return;
    }
    tracks.forEach((t, i) => {
      const li = document.createElement('li');
      if(currentSource && currentSource.type === 'file' && currentSource.index === i) li.classList.add('playing');
      const nameSpan = document.createElement('span');
      nameSpan.className = 't-name';
      nameSpan.textContent = t.name;
      nameSpan.addEventListener('click', () => playTrack(i));
      nameSpan.style.cursor = 'pointer';
      const del = document.createElement('button');
      del.className = 'q-del';
      del.textContent = '×';
      del.addEventListener('click', () => removeTrack(i));
      li.appendChild(nameSpan);
      li.appendChild(del);
      trackListEl.appendChild(li);
    });
  }

  function removeTrack(i){
    const t = tracks[i];
    if(currentSource && currentSource.type === 'file' && currentSource.index === i){
      audioPlayer.pause();
      audioPlayer.src = '';
      currentSource = null;
      isPlaying = false;
      updatePlayButton();
      nowPlayingEl.textContent = 'Nothing playing';
    }
    URL.revokeObjectURL(t.url);
    tracks.splice(i, 1);
    renderTrackList();
  }

  function playTrack(i){
    if(i < 0 || i >= tracks.length) return;
    stopAllPlayback();
    currentSource = { type: 'file', index: i };
    audioPlayer.src = tracks[i].url;
    audioPlayer.play().then(() => {
      isPlaying = true;
      updatePlayButton();
    }).catch(() => { isPlaying = false; updatePlayButton(); });
    nowPlayingEl.textContent = tracks[i].name;
    renderPresetList();
    renderTrackList();
  }

  function updatePlayButton(){
    musicPlayBtn.textContent = isPlaying ? '❚❚' : '▶';
  }

  musicPlayBtn.addEventListener('click', () => {
    if(!currentSource){
      if(tracks.length > 0) playTrack(0);
      return;
    }
    if(currentSource.type === 'youtube'){
      if(!ytPlayer) return;
      if(isPlaying){ ytPlayer.pauseVideo(); } else { ytPlayer.playVideo(); }
      // isPlaying/updatePlayButton handled by onYtStateChange
    } else {
      if(isPlaying){
        audioPlayer.pause();
        isPlaying = false;
      } else {
        audioPlayer.play().catch(() => {});
        isPlaying = true;
      }
      updatePlayButton();
    }
  });

  audioPlayer.addEventListener('ended', () => {
    if(!currentSource || currentSource.type !== 'file' || tracks.length === 0) return;
    const next = (currentSource.index + 1) % tracks.length;
    playTrack(next);
  });

  musicVolume.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    audioPlayer.volume = v;
    if(ytPlayer && ytPlayer.setVolume) ytPlayer.setVolume(v * 100);
  });
  audioPlayer.volume = parseFloat(musicVolume.value);

  musicUploadBtn.addEventListener('click', () => musicUploadFile.click());
  musicUploadFile.addEventListener('change', (e) => {
    Array.from(e.target.files).forEach(file => {
      tracks.push({
        id: ++trackIdCounter,
        name: file.name.replace(/\.[^/.]+$/, ''),
        url: URL.createObjectURL(file)
      });
    });
    renderTrackList();
    musicUploadFile.value = '';
  });

  renderPresetList();
  renderTrackList();
  if(location.protocol === 'file:'){
    nowPlayingEl.textContent = 'Open via a real web address for YouTube playback (see hint below)';
  }

  // ---------- Quotes management ----------
  function renderList(){
    countEl.textContent = quotes.length;
    quoteListEl.innerHTML = '';
    if(quotes.length === 0){
      const li = document.createElement('div');
      li.className = 'empty-list';
      li.textContent = 'Nothing yet';
      quoteListEl.appendChild(li);
      return;
    }
    quotes.forEach((q, i) => {
      const li = document.createElement('li');
      const span = document.createElement('span');
      span.className = 'q-text';
      span.textContent = q.author ? `${q.text} — ${q.author}` : q.text;
      const del = document.createElement('button');
      del.className = 'q-del';
      del.textContent = '×';
      del.addEventListener('click', () => {
        quotes.splice(i,1);
        saveQuotes();
        renderList();
      });
      li.appendChild(span);
      li.appendChild(del);
      quoteListEl.appendChild(li);
    });
  }

  function addQuote(){
    const text = quoteInput.value.trim();
    if(!text) return;
    const author = authorInput.value.trim();
    quotes.push({ text, author });
    saveQuotes();
    quoteInput.value = '';
    authorInput.value = '';
    renderList();
    ensureLoop();
  }
  addBtn.addEventListener('click', addQuote);
  quoteInput.addEventListener('keydown', (e) => {
    if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)){
      e.preventDefault();
      addQuote();
    }
  });
  authorInput.addEventListener('keydown', (e) => {
    if(e.key === 'Enter'){
      e.preventDefault();
      addQuote();
    }
  });

  // ---------- Order ----------
  document.querySelectorAll('.seg button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.order === order);
    btn.addEventListener('click', () => {
      document.querySelectorAll('.seg button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      order = btn.dataset.order;
      saveSettings();
    });
  });

  // ---------- Interval ----------
  intervalSlider.value = intervalSec;
  intervalValue.textContent = (intervalSec % 1 === 0 ? intervalSec : intervalSec.toFixed(1)) + 's';
  intervalSlider.addEventListener('input', (e) => {
    intervalSec = parseFloat(e.target.value);
    intervalValue.textContent = (intervalSec % 1 === 0 ? intervalSec : intervalSec.toFixed(1)) + 's';
    saveSettings();
    restartLoop();
  });

  // ---------- Max on screen ----------
  function updateMaxDisplay(){ maxCountEl.textContent = maxOnScreen; }
  updateMaxDisplay();
  decMax.addEventListener('click', () => { if(maxOnScreen>1){ maxOnScreen--; updateMaxDisplay(); saveSettings(); } });
  incMax.addEventListener('click', () => { if(maxOnScreen<5){ maxOnScreen++; updateMaxDisplay(); saveSettings(); } });

  // ---------- Picking next quote ----------
  function pickNext(){
    if(quotes.length === 0) return null;
    if(quotes.length === 1) return quotes[0];
    if(order === 'sequential'){
      const q = quotes[seqIndex % quotes.length];
      seqIndex++;
      return q;
    } else {
      let idx;
      do { idx = Math.floor(Math.random() * quotes.length); } while(idx === lastRandomIndex);
      lastRandomIndex = idx;
      return quotes[idx];
    }
  }

  // ---------- Reading-time based hold duration ----------
  function computeHold(text){
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const readMs = words * 340;       // ~175 words/min reading pace
    return Math.min(13000, Math.max(3200, 2200 + readMs));
  }

  // ---------- Overlap avoidance ----------
  // Tracks pixel bounding boxes of quotes currently on the board.
  const activeRects = []; // { id, x1,y1,x2,y2 }
  let rectIdCounter = 0;
  const OVERLAP_MARGIN = 22; // px breathing room between quotes

  function rectsOverlap(a, b){
    return !(a.x2 + OVERLAP_MARGIN < b.x1 || a.x1 - OVERLAP_MARGIN > b.x2 ||
             a.y2 + OVERLAP_MARGIN < b.y1 || a.y1 - OVERLAP_MARGIN > b.y2);
  }

  function findFreeSpot(width, height, boardW, boardH){
    const marginX = Math.min(boardW * 0.16, boardW / 2 - width / 2 - 4);
    const marginY = Math.min(boardH * 0.14, boardH / 2 - height / 2 - 4);
    const minCx = Math.max(width / 2 + 8, marginX + width / 2);
    const maxCx = Math.min(boardW - width / 2 - 8, boardW - marginX - width / 2);
    const minCy = Math.max(height / 2 + 8, marginY + height / 2);
    const maxCy = Math.min(boardH - height / 2 - 8, boardH - marginY - height / 2);

    const attempts = 24;
    for(let i = 0; i < attempts; i++){
      const cx = minCx + Math.random() * Math.max(1, maxCx - minCx);
      const cy = minCy + Math.random() * Math.max(1, maxCy - minCy);
      const candidate = { x1: cx - width/2, y1: cy - height/2, x2: cx + width/2, y2: cy + height/2 };
      const collides = activeRects.some(r => rectsOverlap(candidate, r));
      if(!collides) return { cx, cy, rect: candidate };
    }
    return null; // board too crowded right now
  }

  // ---------- Spawning ----------
  function spawnQuote(){
    if(quotes.length === 0 || onScreenCount >= maxOnScreen) return;
    const quote = pickNext();
    if(!quote) return;
    const text = quote.text;
    const author = quote.author;

    const el = document.createElement('div');
    el.className = 'quote';
    const body = document.createElement('span');
    body.className = 'q-body';
    body.textContent = text;
    el.appendChild(body);
    if(author){
      const authorEl = document.createElement('span');
      authorEl.className = 'q-author';
      authorEl.textContent = `— ${author}`;
      el.appendChild(authorEl);
    }
    el.style.visibility = 'hidden';
    el.style.left = '0px';
    el.style.top = '0px';

    // Random-but-bounded size: shorter quotes lean larger, longer ones
    // smaller, with a real (not diluted) random spread — bounded so it
    // never gets absurdly big or unreadably small. Phones get a lower
    // floor/ceiling so more quotes can fit on screen at once without
    // overlapping, instead of one or two large ones hogging the space.
    const isNarrowScreen = window.innerWidth <= 480;
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    const lengthFactor = wordCount <= 5 ? 1.25 : wordCount <= 11 ? 1.0 : 0.8;
    const jitter = 0.85 + Math.random() * 0.3; // wider, clearly visible spread
    const scale = lengthFactor * jitter;
    const sizeMin = isNarrowScreen ? 0.85 : 1.2;
    const sizeMax = isNarrowScreen ? 1.5 : 2.6;
    const sizeMult = isNarrowScreen ? 1.0 : 1.7;
    el.style.fontSize = `clamp(${sizeMin}rem, ${(sizeMult * scale).toFixed(2)}rem, ${sizeMax}rem)`;
    el.style.color = textColorFor(bgColor.value);

    layer.appendChild(el);

    // Measure real rendered size (after text wraps against max-width)
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const boardRect = board.getBoundingClientRect();

    const spot = findFreeSpot(w, h, boardRect.width, boardRect.height);
    if(!spot){
      // Board is too crowded right now — skip this tick, try again next one
      el.remove();
      return;
    }

    const id = ++rectIdCounter;
    const rect = { id, ...spot.rect };
    activeRects.push(rect);

    onScreenCount++;
    emptyState.style.opacity = '0';

    el.style.left = spot.cx + 'px';
    el.style.top = spot.cy + 'px';
    el.style.visibility = 'visible';

    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.classList.add('visible');
    }));

    const holdMs = computeHold(text);

    setTimeout(() => {
      el.classList.remove('visible');
      el.classList.add('fading');
      // Free up its space once it's mostly faded out visually (roughly
      // halfway through the fade transition), not the instant fading
      // starts — otherwise a new quote could claim the spot while the
      // old one is still readable.
      setTimeout(() => {
        const idx = activeRects.findIndex(r => r.id === id);
        if(idx !== -1) activeRects.splice(idx, 1);
      }, 900);

      el.addEventListener('transitionend', function onEnd(ev){
        if(ev.propertyName !== 'opacity') return;
        el.removeEventListener('transitionend', onEnd);
        el.remove();
        onScreenCount = Math.max(0, onScreenCount - 1);
        if(quotes.length === 0 && layer.children.length === 0){
          emptyState.style.opacity = '0.55';
        }
      });
    }, holdMs);
  }

  function ensureLoop(){
    if(spawnTimer) return;
    spawnTimer = setInterval(() => {
      spawnQuote();
    }, intervalSec * 1000);
    spawnQuote();
  }
  function restartLoop(){
    if(spawnTimer){
      clearInterval(spawnTimer);
      spawnTimer = null;
    }
    if(quotes.length > 0) ensureLoop();
  }

  // Kick things off
  updateMaxDisplay();
  intervalValue.textContent = intervalSec + 's';

  // Seed example quotes only on a genuine first run (nothing saved yet) —
  // never overwrite quotes the person already has stored.
  const isFirstRun = loadJSON(STORE_QUOTES_KEY, null) === null;
  if(isFirstRun){
    quotes = [
      { text: 'Discipline is the bridge between goals and accomplishment.', author: 'Jim Rohn' },
      { text: 'Small steps every day beat big leaps once in a while.', author: '' },
      { text: 'Do what you can, with what you have, where you are.', author: 'Theodore Roosevelt' }
    ];
    saveQuotes();
  }
  renderList();
  ensureLoop();

})();
