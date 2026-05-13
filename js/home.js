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

function safeText(s) {
    return (s === undefined || s === null) ? "" : String(s);
}

function showMessage(message, type = 'info') {
    const container = document.getElementById("recommended-playlists");
    if (!container) return;
    
    const colors = {
        'info': '#2196F3',
        'success': '#4CAF50',
        'warning': '#FF9800',
        'error': '#f44336'
    };
    
    const icons = {
        'info': 'ℹ️',
        'success': '✅',
        'warning': '⚠️',
        'error': '❌'
    };
    
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        background: ${colors[type]}15;
        border: 1px solid ${colors[type]}40;
        border-left: 4px solid ${colors[type]};
        padding: 15px 20px;
        margin: 15px 0;
        border-radius: 8px;
        font-size: 15px;
        color: #333;
    `;
    messageDiv.innerHTML = `${icons[type]} ${message}`;
    
    if (container.firstChild && !container.firstChild.classList?.contains('loading')) {
        container.insertBefore(messageDiv, container.firstChild);
    } else {
        container.appendChild(messageDiv);
    }
}

// ==================== Page Load ====================
window.addEventListener("DOMContentLoaded", async () => {    
    const token = localStorage.getItem("authToken");
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    if (!token) {
        alert("Please login first!");
        window.location.href = "../pages/login.html";
        return;
    }

    currentUser = user;

    const welcomeMsg = document.getElementById("welcome-message");
    const studyFieldMsg = document.getElementById("study-field-message");
    
    if (welcomeMsg && user.username) {
        welcomeMsg.textContent = `Welcome back, ${user.username}!`;
    }

    if (studyFieldMsg && user.study_field) {
        studyFieldMsg.textContent = `Let's study ${user.study_field} together`;
    }

    try {
        const response = await fetch(`${BACKEND_BASE}/verify-session`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!response.ok) {
            alert("Session expired. Please login again.");
            localStorage.removeItem("authToken");
            localStorage.removeItem("user");
            window.location.href = "../pages/login.html";
            return;
        }

        const data = await response.json();
        if (!data.success) {
            alert("Session expired. Please login again.");
            localStorage.removeItem("authToken");
            localStorage.removeItem("user");
            window.location.href = "../pages/login.html";
            return;
        }
    } catch (err) {
        console.error("Session error:", err);
    }

    await loadRecommendedContent();
    setupSearch();
});

// ==================== Load Content ====================
async function loadRecommendedContent() {
    const container = document.getElementById("recommended-playlists");
    if (!container) return;

    const rawStudy = (currentUser?.study_field) || "computer science";
    const studyField = String(rawStudy).toLowerCase().trim();
    

    let keywords = STUDY_FIELD_KEYWORDS[studyField];
    if (!keywords) {
        keywords = [
            `${studyField} tutorial`,
            `${studyField} course`,
            `learn ${studyField}`
        ];
    }
    
    
    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

    let totalVideos = 0;
    let sectionsCreated = 0;

    for (let i = 0; i < Math.min(keywords.length, 5); i++) {
        const keyword = keywords[i];
        
        try {
            const videos = await searchYouTube(keyword, 6);
            
            if (videos.length > 0) {
                if (sectionsCreated === 0) {
                    container.innerHTML = '';
                }
                
                const section = createPlaylistSection(keyword, videos);
                container.appendChild(section);
                
                totalVideos += videos.length;
                sectionsCreated++;
                
            }
        } catch (error) {
            console.error(` Error: ${keyword}`, error);
        }
        
        if (sectionsCreated >= 3) break;
    }


    if (sectionsCreated === 0) {
        container.innerHTML = `
            <div class="no-results">
                <h2> No Content Found</h2>
                <p>Could not find educational videos for "${studyField}"</p>
                <p> Try using the search bar  or change your study field in settings</p>
            </div>
        `;
        showMessage(` No content found for "${studyField}". Try searching manually!`, 'error');
    } else {
    }
}

// ==================== Search YouTube ====================
async function searchYouTube(query, maxResults = 12) {
    try {
        const url = `${BACKEND_BASE}/youtube-search?q=${encodeURIComponent(query)}&max=${maxResults}`;

        const response = await fetch(url);
        
        if (!response.ok) {
            console.error(" HTTP Error:", response.status);
            return [];
        }

        const data = await response.json();

        if (data.error) {
            console.error(" API Error:", data.error);
            return [];
        }

        return data.items || [];
        
    } catch (error) {
        console.error(" Error:", error);
        return [];
    }
}

// ==================== Create Section ====================
function createPlaylistSection(title, videos) {
    const section = document.createElement("section");
    section.className = "playlist-section";

    const titleEl = document.createElement("h2");
    titleEl.className = "playlist-title";
    titleEl.textContent = title.charAt(0).toUpperCase() + title.slice(1);

    const grid = document.createElement("div");
    grid.className = "video-grid";

    videos.forEach(video => {
        const card = createVideoCard(video);
        grid.appendChild(card);
    });

    section.appendChild(titleEl);
    section.appendChild(grid);
    return section;
}

// ==================== Create Video Card ====================
function createVideoCard(video) {
    let videoId = "";
    if (typeof video.id === "string") {
        videoId = video.id;
    } else if (video.id?.videoId) {
        videoId = video.id.videoId;
    } else if (video.snippet?.resourceId?.videoId) {
        videoId = video.snippet.resourceId.videoId;
    }

    const snippet = video.snippet || {};
    const thumbnail = snippet.thumbnails?.high?.url || 
                    snippet.thumbnails?.medium?.url || 
                    snippet.thumbnails?.default?.url || "";
    const title = safeText(snippet.title);
    const channel = safeText(snippet.channelTitle);

    const card = document.createElement("div");
    card.className = "video-card col-lg-3 col-md-5 col-sm-10";

    card.innerHTML = `
        <img src="${thumbnail}" alt="${title}" class="video-thumbnail">
        <div class="video-info">
            <div class="video-title">${title}</div>
            <div class="video-channel">${channel}</div>
            <div class="video-actions">
                <button class="btn-watch"><i class="fas fa-play"></i> Watch</button>
                <button class="btn-save"><i class="fas fa-bookmark"></i> Save</button>
            </div>
        </div>
    `;

    const watchBtn = card.querySelector(".btn-watch");
    const saveBtn = card.querySelector(".btn-save");

    if (watchBtn) {
        watchBtn.addEventListener("click", () => {
            if (videoId) {
                openVideoModal(videoId); 
            } else {
                alert("Video ID not available.");
            }
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener("click", () => {
            saveVideo(videoId, title, thumbnail, channel);
        });
    }

    return card;
}

// ==================== Open Video Modal (NEW!) ====================
function openVideoModal(videoId) {
    const modal = document.getElementById('video-modal');
    const player = document.getElementById('video-player');
    
    // Set YouTube embed URL
    player.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    
    // Show modal
    modal.classList.add('active');
    
}

// ==================== Save Video ====================
function saveVideo(videoId, title, thumbnail, channel) {
    if (!videoId) {
        alert("Cannot save this video.");
        return;
    }

    let savedVideos = JSON.parse(localStorage.getItem("savedVideos") || "[]");
    
    if (savedVideos.find(v => v.videoId === videoId)) {
        alert("Video already saved! ");
        return;
    }

    savedVideos.push({
        videoId,
        title,
        thumbnail,
        channel,
        savedAt: new Date().toISOString()
    });

    try {
        localStorage.setItem("savedVideos", JSON.stringify(savedVideos));
        alert(" Video saved successfully!");
    } catch (e) {
        console.error("Save error:", e);
        alert(" Save failed.");
    }
}

// ==================== Setup Search ====================
function setupSearch() {
    const searchInput = document.getElementById("search-input");
    const searchBtn = document.getElementById("search-btn");
    const searchResults = document.getElementById("search-results");
    const searchVideos = document.getElementById("search-videos");

    if (!searchInput || !searchBtn) return;

    searchBtn.addEventListener("click", performSearch);
    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") performSearch();
    });

    async function performSearch() {
        const query = searchInput.value.trim();
        if (!query) {
            alert(" Please enter search keywords");
            return;
        }

        const prevText = searchBtn.innerHTML;
        searchBtn.disabled = true;

        if (searchVideos) {
            searchVideos.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i> Searching for "${query}"...</div>`;
        }

        try {
            
            const enhancedQuery = query.includes("tutorial") || query.includes("course") 
                ? query 
                : `${query} tutorial`;
            
            const videos = await searchYouTube(enhancedQuery, 12);
            
            if (searchVideos) searchVideos.innerHTML = "";
            
            if (videos.length === 0) {
                if (searchVideos) {
                    searchVideos.innerHTML = `
                        <div class="no-results">
                            <h3> No Results Found</h3>
                            <p>Could not find videos for "${query}"</p>
                            <p> Try:</p>
                            <ul style="text-align: left; padding-left: 40px;">
                                <li>Different search words</li>
                                <li>Add "tutorial" or "course"</li>
                                <li>Be more specific</li>
                            </ul>
                        </div>
                    `;
                }
            } else {
                
                const successMsg = document.createElement('div');
                successMsg.style.cssText = `
                    padding: 15px;
                    margin-bottom: 20px;
                    border-radius: 8px;
                    font-weight: 600;
                `;
                successMsg.textContent = ` Found ${videos.length} videos for "${query}"`;
                searchVideos.appendChild(successMsg);
                
                const grid = document.createElement('div');
                grid.className = 'video-grid';
                
                videos.forEach(video => {
                    const card = createVideoCard(video);
                    grid.appendChild(card);
                });
                
                searchVideos.appendChild(grid);
            }

            if (searchResults) {
                searchResults.style.display = "block";
                setTimeout(() => {
                    searchResults.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 100);
            }
        } catch (error) {
            console.error(" Search error:", error);
            if (searchVideos) {
                searchVideos.innerHTML = `
                    <div class="no-results">
                        <h3> Error occurred</h3>
                        <p>${error.message}</p>
                    </div>
                `;
            }
        } finally {
            searchBtn.innerHTML = prevText;
            searchBtn.disabled = false;
        }
    }
}

// ==================== Logout ====================
const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        
        if (!confirm("Are you sure you want to log out?")) return;

        const token = localStorage.getItem("authToken");

        try {
            await fetch(`${BACKEND_BASE}/logout`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });
        } catch (err) {
            console.error("Logout error:", err);
        }

        localStorage.removeItem("authToken");
        localStorage.removeItem("user");
        alert("Logged out successfully!");
        window.location.href = "../index.html";
    });
}

