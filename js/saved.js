    function loadSavedVideos() {
            const savedVideos = JSON.parse(localStorage.getItem("savedVideos") || "[]");
            const container = document.getElementById("saved-videos-container");
            const countEl = document.getElementById("saved-count");
            const clearAllBtn = document.getElementById("clear-all-btn");

            countEl.textContent = `${savedVideos.length} video(s) saved`;

            if (savedVideos.length === 0) {
                container.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1;">
                        <i class="fas fa-bookmark"></i>
                        <h3>No saved videos yet</h3>
                        <p>Start saving videos from the home page!</p>
                        <a href="../pages/home.html" class="btn button-primary mt-3">Go to Home</a>
                    </div>
                `;
                clearAllBtn.style.display = "none";
                return;
            }

            clearAllBtn.style.display = "inline-block";
            container.innerHTML = "";

            savedVideos.reverse().forEach((video, index) => {
                const card = document.createElement("div");
                card.className = "video-card";

                const savedDate = new Date(video.savedAt).toLocaleDateString();

                card.innerHTML = `
                    <img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail">
                    <div class="video-info">
                        <div class="video-title">${video.title}</div>
                        <div class="video-channel">${video.channel}</div>
                        <div class="video-date">Saved on ${savedDate}</div>
                        <div class="video-actions">
                            <button class="btn-watch" onclick="watchVideo('${video.videoId}')">
                                <i class="fas fa-play"></i> Watch
                            </button>
                            <button class="btn-remove" onclick="removeVideo(${savedVideos.length - 1 - index})">
                                <i class="fas fa-trash"></i> Remove
                            </button>
                        </div>
                    </div>
                `;

                container.appendChild(card);
            });
        }

        function watchVideo(videoId) {
            window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
        }

        function removeVideo(index) {
            const savedVideos = JSON.parse(localStorage.getItem("savedVideos") || "[]");
            savedVideos.splice(index, 1);
            localStorage.setItem("savedVideos", JSON.stringify(savedVideos));
            loadSavedVideos();
        }

        document.getElementById("clear-all-btn").addEventListener("click", () => {
            if (confirm("Are you sure you want to remove all saved videos?")) {
                localStorage.removeItem("savedVideos");
                loadSavedVideos();
            }
        });


        loadSavedVideos();
