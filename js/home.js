// ===== HOME.JS - FIXED VERSION =====

const BACKEND_BASE = "https://edu-sync-back-end-production.up.railway.app";

const STUDY_FIELD_KEYWORDS = {
  "architecture": ["architecture tutorial", "architectural design", "building design"],
  "ai": ["artificial intelligence tutorial", "machine learning course", "deep learning"],
  "biology": ["biology tutorial", "genetics course", "cell biology"],
  "business administration": ["business management tutorial", "MBA course", "entrepreneurship"],
  "chemistry": ["chemistry tutorial", "organic chemistry course"],
  "computer science": ["python tutorial", "javascript tutorial", "programming course"],
  "cyber security": ["cybersecurity tutorial", "ethical hacking course", "network security"],
  "data science": ["data science tutorial", "machine learning python", "data analysis"],
  "education": ["teaching methods", "educational psychology", "pedagogy"],
  "engineering": ["engineering tutorial", "mechanical engineering", "civil engineering"],
  "graphic design": ["graphic design tutorial", "photoshop tutorial", "design course"],
  "law": ["law tutorial", "legal studies", "constitutional law"],
  "marketing": ["digital marketing tutorial", "marketing strategy", "SEO course"],
  "mathematics": ["mathematics tutorial", "calculus course", "algebra"],
  "medicine": ["medical lecture", "anatomy tutorial", "physiology"],
  "pharmacy": ["pharmacy course", "pharmacology tutorial"],
  "physics": ["physics tutorial", "quantum mechanics", "physics course"],
  "psychology": ["psychology tutorial", "cognitive psychology", "behavioral psychology"],
  "statistics": ["statistics tutorial", "data analysis course", "probability"],
  "frontend": ["html css tutorial", "javascript course", "react tutorial"],
  "backend": ["node.js tutorial", "python django", "API development"]
};

let currentUser = null;
// FIX: global playlist for autoplay next video
let currentPlaylist = [];
let currentVideoIndex = -1;

function safeText(s) {
  return (s === undefined || s === null) ? "" : String(s);
}

// FIX: toast instead of alert()
function showToast(message, type = 'info') {
  let toast = document.getElementById('edu-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'edu-toast';
    toast.style.cssText = `
      position:fixed;bottom:30px;left:50%;transform:translateX(-50%);
      padding:12px 24px;border-radius:25px;font-size:14px;font-weight:600;
      z-index:9999;opacity:0;transition:opacity 0.3s ease;
      box-shadow:0 4px 15px rgba(0,0,0,0.2);max-width:90vw;text-align:center;color:#fff;
    `;
    document.body.appendChild(toast);
  }
  const colors = { info:'#2196F3', success:'#4CAF50', warning:'#FF9800', error:'#f44336' };
  toast.style.background = colors[type] || colors.info;
  toast.textContent = message;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

// ==================== Page Load ====================
window.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("authToken");
  const user  = JSON.parse(localStorage.getItem("user") || "{}");

  if (!token) { window.location.href = "../pages/login.html"; return; }

  currentUser = user;

  const welcomeMsg    = document.getElementById("welcome-message");
  const studyFieldMsg = document.getElementById("study-field-message");

  // FIX: show name OR username (whichever exists)
  const displayName = user.name || user.username || "";
  if (welcomeMsg && displayName) welcomeMsg.textContent = `Welcome back, ${displayName}!`;
  if (studyFieldMsg && user.study_field) studyFieldMsg.textContent = `Let's study ${user.study_field} together`;

  try {
    const res  = await fetch(`${BACKEND_BASE}/verify-session`, { headers: { "Authorization": `Bearer ${token}` } });
    if (!res.ok) { localStorage.removeItem("authToken"); localStorage.removeItem("user"); window.location.href = "../pages/login.html"; return; }
    const data = await res.json();
    if (!data.success) { localStorage.removeItem("authToken"); localStorage.removeItem("user"); window.location.href = "../pages/login.html"; return; }

    // FIX: sync latest user data (study_field might have changed in settings)
    if (data.user) {
      const updated = { ...user, ...data.user };
      localStorage.setItem("user", JSON.stringify(updated));
      currentUser = updated;
      const name = updated.name || updated.username || "";
      if (welcomeMsg && name) welcomeMsg.textContent = `Welcome back, ${name}!`;
      if (studyFieldMsg && updated.study_field) studyFieldMsg.textContent = `Let's study ${updated.study_field} together`;
    }
  } catch (err) { console.error("Session error:", err); }

  await loadRecommendedContent();
  setupSearch();

  // FIX: reload content when study_field changes in settings (localStorage event)
  window.addEventListener('storage', async (e) => {
    if (e.key === 'user') {
      const newUser  = JSON.parse(e.newValue || "{}");
      const oldField = currentUser?.study_field || "";
      const newField = newUser?.study_field || "";
      if (newField && newField !== oldField) {
        currentUser = newUser;
        if (studyFieldMsg) studyFieldMsg.textContent = `Let's study ${newField} together`;
        await loadRecommendedContent();
      }
    }
  });
});

// ==================== Load Content ====================
async function loadRecommendedContent() {
  const container = document.getElementById("recommended-playlists");
  if (!container) return;

  const rawStudy   = currentUser?.study_field || "computer science";
  const studyField = String(rawStudy).toLowerCase().trim();
  const keywords   = STUDY_FIELD_KEYWORDS[studyField] || [`${studyField} tutorial`, `${studyField} course`, `learn ${studyField}`];

  container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
  currentPlaylist = [];
  currentVideoIndex = -1;

  let sectionsCreated = 0;

  for (let i = 0; i < Math.min(keywords.length, 5); i++) {
    try {
      const videos = await searchYouTube(keywords[i], 6);
      if (videos.length > 0) {
        if (sectionsCreated === 0) container.innerHTML = '';
        container.appendChild(createPlaylistSection(keywords[i], videos));
        // Build global playlist for autoplay
        videos.forEach(v => {
          const id = typeof v.id === "string" ? v.id : (v.id?.videoId || v.snippet?.resourceId?.videoId || "");
          if (id) currentPlaylist.push({ id, title: safeText(v.snippet?.title), thumbnail: v.snippet?.thumbnails?.high?.url || "", channel: safeText(v.snippet?.channelTitle) });
        });
        sectionsCreated++;
      }
    } catch (e) { console.error(e); }
    if (sectionsCreated >= 3) break;
  }

  if (sectionsCreated === 0) {
    container.innerHTML = `<div class="no-results"><h2>No Content Found</h2><p>Could not find videos for "${studyField}". Try searching manually.</p></div>`;
  }
}

// ==================== Search YouTube ====================
async function searchYouTube(query, maxResults = 12) {
  try {
    const res = await fetch(`${BACKEND_BASE}/youtube-search?q=${encodeURIComponent(query)}&max=${maxResults}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.error ? [] : (data.items || []);
  } catch (e) { return []; }
}

// ==================== Create Section ====================
function createPlaylistSection(title, videos) {
  const section   = document.createElement("section");
  section.className = "playlist-section";
  const titleEl   = document.createElement("h2");
  titleEl.className = "playlist-title";
  titleEl.textContent = title.charAt(0).toUpperCase() + title.slice(1);
  const grid = document.createElement("div");
  grid.className = "video-grid justify-content-center";
  videos.forEach(v => grid.appendChild(createVideoCard(v)));
  section.appendChild(titleEl);
  section.appendChild(grid);
  return section;
}

// ==================== Create Video Card ====================
function createVideoCard(video) {
  let videoId = typeof video.id === "string" ? video.id : (video.id?.videoId || video.snippet?.resourceId?.videoId || "");
  const snippet   = video.snippet || {};
  const thumbnail = snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || "";
  const title     = safeText(snippet.title);
  const channel   = safeText(snippet.channelTitle);

  const card = document.createElement("div");
  // FIX: mx-auto centers cards on mobile
  card.className = "video-card col-lg-3 col-md-5 col-sm-10 mx-auto";
  card.innerHTML = `
    <img src="${thumbnail}" alt="${title}" class="video-thumbnail" loading="lazy">
    <div class="video-info">
      <div class="video-title">${title}</div>
      <div class="video-channel">${channel}</div>
      <div class="video-actions">
        <button class="btn-watch"><i class="fas fa-play"></i> Watch</button>
        <button class="btn-save"><i class="fas fa-bookmark"></i> Save</button>
      </div>
    </div>`;

  card.querySelector(".btn-watch")?.addEventListener("click", () => {
    if (videoId) {
      const idx = currentPlaylist.findIndex(v => v.id === videoId);
      openVideoModal(videoId, idx >= 0 ? idx : 0);
    }
  });
  card.querySelector(".btn-save")?.addEventListener("click", () => saveVideo(videoId, title, thumbnail, channel));
  return card;
}

// ==================== Video Modal ====================
// FIX: autoplay next video when current ends
function openVideoModal(videoId, playlistIndex = 0) {
  const modal  = document.getElementById('video-modal');
  const player = document.getElementById('video-player');
  if (!modal || !player) return;

  currentVideoIndex = playlistIndex;
  // enablejsapi=1 allows detecting video end via postMessage
  player.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&rel=0`;
  modal.classList.add('active');

  window.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.event === "onStateChange" && data.info === 0) playNextVideo();
    } catch (e) {}
  };
}

function playNextVideo() {
  if (!currentPlaylist.length) return;
  currentVideoIndex = (currentVideoIndex + 1) % currentPlaylist.length;
  const next = currentPlaylist[currentVideoIndex];
  const player = document.getElementById('video-player');
  if (next?.id && player) player.src = `https://www.youtube.com/embed/${next.id}?autoplay=1&enablejsapi=1&rel=0`;
}

window.closeVideoModal = function() {
  const modal  = document.getElementById('video-modal');
  const player = document.getElementById('video-player');
  if (player) player.src = '';
  if (modal)  modal.classList.remove('active');
  window.onmessage = null;
};

document.getElementById('video-modal')?.addEventListener('click', function(e) { if (e.target === this) closeVideoModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeVideoModal(); });

// ==================== Save Video ====================
function saveVideo(videoId, title, thumbnail, channel) {
  if (!videoId) { showToast("Cannot save this video.", 'error'); return; }
  let saved = JSON.parse(localStorage.getItem("savedVideos") || "[]");
  if (saved.find(v => v.videoId === videoId)) { showToast("Video already saved!", 'warning'); return; }
  saved.push({ videoId, title, thumbnail, channel, savedAt: new Date().toISOString() });
  try {
    localStorage.setItem("savedVideos", JSON.stringify(saved));
    showToast("Video saved successfully!", 'success');
  } catch (e) { showToast("Save failed.", 'error'); }
}

// ==================== Search ====================
function setupSearch() {
  const searchInput   = document.getElementById("search-input");
  const searchBtn     = document.getElementById("search-btn");
  const searchResults = document.getElementById("search-results");
  const searchVideos  = document.getElementById("search-videos");
  if (!searchInput || !searchBtn) return;

  searchBtn.addEventListener("click", performSearch);
  searchInput.addEventListener("keypress", e => { if (e.key === "Enter") performSearch(); });

  async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) { showToast("Please enter search keywords", 'warning'); return; }
    searchBtn.disabled = true;
    if (searchVideos) searchVideos.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i> Searching...</div>`;
    try {
      const q = (query.includes("tutorial") || query.includes("course")) ? query : `${query} tutorial`;
      const videos = await searchYouTube(q, 12);
      if (searchVideos) searchVideos.innerHTML = "";
      if (!videos.length) {
        if (searchVideos) searchVideos.innerHTML = `<div class="no-results"><h3>No results for "${query}"</h3></div>`;
      } else {
        const grid = document.createElement('div');
        grid.className = 'video-grid justify-content-center';
        videos.forEach(v => grid.appendChild(createVideoCard(v)));
        searchVideos?.appendChild(grid);
        currentPlaylist = videos.map(v => ({
          id: typeof v.id === "string" ? v.id : (v.id?.videoId || ""),
          title: safeText(v.snippet?.title),
          thumbnail: v.snippet?.thumbnails?.high?.url || "",
          channel: safeText(v.snippet?.channelTitle)
        }));
      }
      if (searchResults) { searchResults.style.display = "block"; setTimeout(() => searchResults.scrollIntoView({ behavior: "smooth" }), 100); }
    } catch (e) {
      if (searchVideos) searchVideos.innerHTML = `<div class="no-results"><h3>Error: ${e.message}</h3></div>`;
    } finally { searchBtn.disabled = false; }
  }
}

// ==================== Logout ====================
document.getElementById("logout-btn")?.addEventListener("click", async (e) => {
  e.preventDefault();
  if (!confirm("Are you sure you want to log out?")) return;
  try { await fetch(`${BACKEND_BASE}/logout`, { method: "POST", headers: { "Authorization": `Bearer ${localStorage.getItem("authToken")}` } }); } catch (e) {}
  localStorage.removeItem("authToken");
  localStorage.removeItem("user");
  window.location.href = "../index.html";
});