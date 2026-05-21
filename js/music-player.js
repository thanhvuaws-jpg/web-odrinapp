/**
 * Royal Restaurant - Floating Music Player Component (Dual Mode: MP3 + YouTube)
 * Fully self-contained. Loaded dynamically by admin.html and cashier.html.
 */
document.addEventListener("DOMContentLoaded", () => {
    // 1. Tracks playlist definition (Mix of MP3 and YouTube)
    const playlist = [
        { title: "Lofi Thư Giãn Học Tập (YTB)", artist: "Royal Lofi", youtubeId: "5LiZMuNjJ7k" },
        { title: "Lofi Chill Nhẹ Nhàng (YTB)", artist: "Royal Chill", youtubeId: "MjE3Yxrv5NY" },
        { title: "Lofi Nhẹ Nhàng Bình Yên (YTB)", artist: "Royal Cafe Lofi", youtubeId: "ynyYroYJQ8g" },
        { title: "Lofi Study & Work", artist: "Royal Beats", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
        { title: "Jazz Cafe Afternoon", artist: "Royal Cafe", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
        { title: "Coffee House Acoustic", artist: "Royal Acoustic", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
        { title: "Relaxing Piano Suite", artist: "Royal Classical", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" },
        { title: "Sunset Lounge Chill", artist: "Royal Golden Hour", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3" }
    ];

    let currentTrackIndex = 0;
    let isPlaying = false;
    let isMuted = false;
    let prevVolume = 0.8; // 0.0 to 1.0
    let playMode = "audio"; // "audio" or "youtube"
    
    // Timer interval for YouTube progress tracking
    let ytProgressInterval = null;

    // 2. Create HTML5 Audio element
    const audio = new Audio();
    audio.volume = prevVolume;

    // 3. Inject CSS styles
    const styleTag = document.createElement("style");
    styleTag.textContent = `
        @keyframes royalSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .royal-spin {
            animation: royalSpin 12s linear infinite;
        }
        .royal-spin-paused {
            animation-play-state: paused;
        }
        #royal-music-playlist::-webkit-scrollbar {
            width: 3px;
        }
        #royal-music-playlist::-webkit-scrollbar-thumb {
            background: rgba(212, 175, 55, 0.4);
            border-radius: 10px;
        }
        /* Custom range styles to ensure golden look */
        .royal-range::-webkit-slider-runnable-track {
            background: #1e293b;
            height: 4px;
            border-radius: 4px;
        }
        .royal-range::-webkit-slider-thumb {
            background: #fbbf24;
            height: 10px;
            width: 10px;
            border-radius: 50%;
            margin-top: -3px;
            appearance: none;
            -webkit-appearance: none;
        }
    `;
    document.head.appendChild(styleTag);

    // 4. Inject HTML layout (Including hidden YouTube container)
    const container = document.createElement("div");
    container.innerHTML = `
        <!-- Hidden YouTube Player Container (cannot be display: none because some browsers stop iframe execution) -->
        <div id="royal-yt-wrapper" style="position: absolute; left: -9999px; top: -9999px; width: 1px; height: 1px; opacity: 0; overflow: hidden;">
            <div id="royal-youtube-player"></div>
        </div>

        <!-- Floating Button -->
        <div id="royal-music-btn" class="fixed bottom-6 right-6 z-[9999] w-14 h-14 rounded-full flex items-center justify-center cursor-pointer shadow-lg transition-all duration-300 hover:scale-110 active:scale-95" style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px); border: 2px solid #d4af37; box-shadow: 0 0 15px rgba(212, 175, 55, 0.4);">
            <div id="royal-music-disc" class="w-10 h-10 rounded-full flex items-center justify-center bg-cover bg-center border border-amber-500/30 royal-spin royal-spin-paused" style="background-image: url('https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=120');">
                <div class="w-3.5 h-3.5 rounded-full bg-slate-950 flex items-center justify-center border border-amber-500/50">
                    <i class="fa-solid fa-music text-[7px] text-[#d4af37] animate-pulse"></i>
                </div>
            </div>
        </div>

        <!-- Music Panel -->
        <div id="royal-music-panel" class="fixed bottom-24 right-6 z-[9999] w-72 rounded-2xl p-4 transition-all duration-300 origin-bottom-right scale-0 opacity-0" style="background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(16px); border: 1px solid rgba(212, 175, 55, 0.3); box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);">
            <!-- Header -->
            <div class="flex items-center justify-between border-b border-amber-500/20 pb-2 mb-3">
                <div class="flex items-center space-x-2">
                    <i class="fa-solid fa-crown text-amber-500 text-xs"></i>
                    <span class="text-[10px] uppercase tracking-widest font-bold text-amber-400 font-serif">Royal Playlist</span>
                </div>
                <button id="royal-music-close" class="text-gray-400 hover:text-red-400 transition-colors text-sm">
                    <i class="fa-solid fa-times text-xs"></i>
                </button>
            </div>

            <!-- Track Info -->
            <div class="flex items-center space-x-3 mb-3">
                <div id="royal-music-cd" class="w-12 h-12 rounded-full flex items-center justify-center bg-cover bg-center border border-amber-500/30 shadow-md flex-shrink-0 royal-spin royal-spin-paused" style="background-image: url('https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=200');">
                    <div class="w-3.5 h-3.5 rounded-full bg-slate-950 flex items-center justify-center border border-amber-500/50"></div>
                </div>
                <div class="flex-1 min-w-0">
                    <h5 id="royal-music-title" class="text-xs font-bold text-white truncate pr-1">Tên bài hát</h5>
                    <p id="royal-music-artist" class="text-[9px] text-amber-500 uppercase tracking-wider font-semibold mt-0.5 truncate">Ca sĩ</p>
                </div>
            </div>

            <!-- Progress Bar -->
            <div class="space-y-1 mb-2.5">
                <input type="range" id="royal-music-progress" min="0" max="100" value="0" class="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 royal-range">
                <div class="flex justify-between text-[9px] text-gray-400">
                    <span id="royal-music-current">0:00</span>
                    <span id="royal-music-duration">0:00</span>
                </div>
            </div>

            <!-- Controls -->
            <div class="flex items-center justify-between mb-2.5 px-3">
                <button id="royal-music-prev" class="text-gray-400 hover:text-amber-400 transition-colors text-sm"><i class="fa-solid fa-backward-step"></i></button>
                <button id="royal-music-play" class="w-9 h-9 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center hover:scale-105 active:scale-95 transition-all text-sm shadow-[0_0_10px_rgba(251,191,36,0.3)]"><i class="fa-solid fa-play ml-0.5"></i></button>
                <button id="royal-music-next" class="text-gray-400 hover:text-amber-400 transition-colors text-sm"><i class="fa-solid fa-forward-step"></i></button>
                <button id="royal-music-list-toggle" class="text-gray-400 hover:text-amber-400 transition-colors text-sm"><i class="fa-solid fa-list-ul"></i></button>
            </div>

            <!-- Volume Control -->
            <div class="flex items-center space-x-2 px-1 mb-2 border-t border-amber-500/10 pt-2">
                <i id="royal-music-mute" class="fa-solid fa-volume-high text-[10px] text-gray-400 cursor-pointer hover:text-amber-400 w-4"></i>
                <input type="range" id="royal-music-volume" min="0" max="100" value="80" class="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 royal-range">
            </div>

            <!-- Playlist list -->
            <div id="royal-music-playlist" class="max-h-28 overflow-y-auto space-y-1 mt-2 border-t border-amber-500/10 pt-2 hidden">
                <!-- Tracks dynamically added -->
            </div>
        </div>
    `;
    document.body.appendChild(container);

    // 5. DOM References
    const btnPlay = document.getElementById("royal-music-play");
    const btnPrev = document.getElementById("royal-music-prev");
    const btnNext = document.getElementById("royal-music-next");
    const btnListToggle = document.getElementById("royal-music-list-toggle");
    const btnMute = document.getElementById("royal-music-mute");
    const btnClose = document.getElementById("royal-music-close");
    const btnTogglePanel = document.getElementById("royal-music-btn");
    
    const panel = document.getElementById("royal-music-panel");
    const trackCD = document.getElementById("royal-music-cd");
    const trackDisc = document.getElementById("royal-music-disc");
    const trackTitle = document.getElementById("royal-music-title");
    const trackArtist = document.getElementById("royal-music-artist");
    const trackerProgress = document.getElementById("royal-music-progress");
    const txtCurrentTime = document.getElementById("royal-music-current");
    const txtDuration = document.getElementById("royal-music-duration");
    const valVolume = document.getElementById("royal-music-volume");
    const listPlaylist = document.getElementById("royal-music-playlist");

    // 6. YouTube Player API Setup
    let ytPlayer = null;
    let isYTAPIReady = false;

    // Global callback from YouTube API (Must be declared BEFORE loading script)
    window.onYouTubeIframeAPIReady = function() {
        isYTAPIReady = true;
        initYouTubePlayer();
    };

    // If API loaded already
    if (window.YT && window.YT.Player) {
        isYTAPIReady = true;
        setTimeout(initYouTubePlayer, 100);
    } else {
        // Load YouTube Iframe API Script
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
    }

    function initYouTubePlayer() {
        const initialTrack = playlist[currentTrackIndex];
        const initialVid = (initialTrack && initialTrack.youtubeId) ? initialTrack.youtubeId : '';
        
        ytPlayer = new YT.Player('royal-youtube-player', {
            height: '200',
            width: '200',
            videoId: initialVid,
            playerVars: {
                'autoplay': 0,
                'controls': 0,
                'disablekb': 1,
                'fs': 0,
                'rel': 0,
                'modestbranding': 1,
                'origin': window.location.origin
            },
            events: {
                'onReady': onYTPlayerReady,
                'onStateChange': onYTPlayerStateChange
            }
        });
    }

    function onYTPlayerReady(event) {
        ytPlayer.unMute();
        ytPlayer.setVolume(prevVolume * 100);
        // If current track is YouTube and we toggled play, play it
        if (playMode === "youtube" && isPlaying) {
            ytPlayer.playVideo();
        }
    }

    function onYTPlayerStateChange(event) {
        // YT.PlayerState.ENDED = 0
        if (event.data === 0) {
            nextTrack();
        }
        // YT.PlayerState.PLAYING = 1
        if (event.data === 1) {
            isPlaying = true;
            btnPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
            trackCD.classList.remove("royal-spin-paused");
            trackDisc.classList.remove("royal-spin-paused");
            startYTProgressTimer();
        }
        // YT.PlayerState.PAUSED = 2
        if (event.data === 2 || event.data === 3) {
            stopYTProgressTimer();
        }
    }

    function startYTProgressTimer() {
        if (ytProgressInterval) clearInterval(ytProgressInterval);
        ytProgressInterval = setInterval(() => {
            if (ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
                const currentTime = ytPlayer.getCurrentTime();
                const duration = ytPlayer.getDuration();
                if (duration) {
                    const percent = (currentTime / duration) * 100;
                    trackerProgress.value = percent;
                    txtCurrentTime.textContent = formatTime(currentTime);
                    txtDuration.textContent = formatTime(duration);
                }
            }
        }, 500);
    }

    function stopYTProgressTimer() {
        if (ytProgressInterval) {
            clearInterval(ytProgressInterval);
            ytProgressInterval = null;
        }
    }

    // Load track by index
    function loadTrack(index) {
        currentTrackIndex = index;
        const track = playlist[index];
        trackTitle.textContent = track.title;
        trackArtist.textContent = track.artist;
        
        // Reset progress bar
        trackerProgress.value = 0;
        txtCurrentTime.textContent = "0:00";
        txtDuration.textContent = "0:00";

        // Stop current playing sources
        audio.pause();
        stopYTProgressTimer();
        if (ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
            ytPlayer.pauseVideo();
        }

        if (track.youtubeId) {
            playMode = "youtube";
            // Check if YouTube Player is ready
            if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
                ytPlayer.loadVideoById(track.youtubeId);
                if (!isPlaying) {
                    // Pause right after loading to respect isPlaying state
                    setTimeout(() => ytPlayer.pauseVideo(), 150);
                }
            } else if (isYTAPIReady) {
                // Initialize if not done
                initYouTubePlayer();
            }
        } else {
            playMode = "audio";
            audio.src = track.url;
        }

        // Highlight selected track in list
        const items = listPlaylist.querySelectorAll(".track-item");
        items.forEach((item, idx) => {
            if (idx === index) {
                item.style.backgroundColor = "rgba(212, 175, 55, 0.15)";
                item.style.color = "#fbbf24";
            } else {
                item.style.backgroundColor = "transparent";
                item.style.color = "#94a3b8";
            }
        });
    }

    // Play/Pause Action
    function togglePlay() {
        if (isPlaying) {
            isPlaying = false;
            btnPlay.innerHTML = '<i class="fa-solid fa-play ml-0.5"></i>';
            trackCD.classList.add("royal-spin-paused");
            trackDisc.classList.add("royal-spin-paused");
            
            if (playMode === "youtube") {
                if (ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
                    ytPlayer.pauseVideo();
                }
            } else {
                audio.pause();
            }
        } else {
            isPlaying = true;
            btnPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
            trackCD.classList.remove("royal-spin-paused");
            trackDisc.classList.remove("royal-spin-paused");

            if (playMode === "youtube") {
                if (ytPlayer && typeof ytPlayer.playVideo === 'function') {
                    ytPlayer.unMute();
                    ytPlayer.setVolume(prevVolume * 100);
                    ytPlayer.playVideo();
                } else if (!ytPlayer && isYTAPIReady) {
                    initYouTubePlayer();
                }
            } else {
                audio.play().catch(e => {
                    console.log("Audio play blocked: ", e);
                    isPlaying = false;
                    btnPlay.innerHTML = '<i class="fa-solid fa-play ml-0.5"></i>';
                    trackCD.classList.add("royal-spin-paused");
                    trackDisc.classList.add("royal-spin-paused");
                });
            }
        }
    }

    // Next track
    function nextTrack() {
        let nextIndex = currentTrackIndex + 1;
        if (nextIndex >= playlist.length) nextIndex = 0;
        loadTrack(nextIndex);
        if (isPlaying) {
            if (playMode === "youtube") {
                setTimeout(() => {
                    if (ytPlayer && typeof ytPlayer.playVideo === 'function') ytPlayer.playVideo();
                }, 300);
            } else {
                audio.play().catch(() => {});
            }
        } else {
            togglePlay();
        }
    }

    // Prev track
    function prevTrack() {
        let prevIndex = currentTrackIndex - 1;
        if (prevIndex < 0) prevIndex = playlist.length - 1;
        loadTrack(prevIndex);
        if (isPlaying) {
            if (playMode === "youtube") {
                setTimeout(() => {
                    if (ytPlayer && typeof ytPlayer.playVideo === 'function') ytPlayer.playVideo();
                }, 300);
            } else {
                audio.play().catch(() => {});
            }
        } else {
            togglePlay();
        }
    }

    // Format time helpers
    function formatTime(seconds) {
        if (isNaN(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // Render playlist items
    function renderPlaylist() {
        let html = "";
        playlist.forEach((track, index) => {
            const icon = track.youtubeId ? "fa-brands fa-youtube" : "fa-solid fa-music";
            html += `
                <div class="track-item flex items-center justify-between p-1.5 rounded text-[11px] cursor-pointer hover:bg-white/5 transition-colors text-slate-400" data-idx="${index}">
                    <div class="flex items-center space-x-1.5 flex-1 min-w-0">
                        <i class="${icon} text-[9px] text-amber-500/70"></i>
                        <span class="truncate font-medium">${track.title}</span>
                    </div>
                    <span class="text-[9px] text-gray-500 ml-2 uppercase font-semibold">${track.artist}</span>
                </div>
            `;
        });
        listPlaylist.innerHTML = html;

        // Click track item to play
        listPlaylist.querySelectorAll(".track-item").forEach(item => {
            item.addEventListener("click", () => {
                const idx = parseInt(item.getAttribute("data-idx"));
                const wasPlaying = isPlaying;
                loadTrack(idx);
                isPlaying = true;
                btnPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
                trackCD.classList.remove("royal-spin-paused");
                trackDisc.classList.remove("royal-spin-paused");
                
                if (playMode === "youtube") {
                    setTimeout(() => {
                        if (ytPlayer && typeof ytPlayer.playVideo === 'function') ytPlayer.playVideo();
                    }, 300);
                } else {
                    audio.play().catch(() => {});
                }
            });
        });
    }

    // Audio Event listeners (for MP3 mode)
    audio.addEventListener("timeupdate", () => {
        if (playMode === "audio" && audio.duration) {
            const percent = (audio.currentTime / audio.duration) * 100;
            trackerProgress.value = percent;
            txtCurrentTime.textContent = formatTime(audio.currentTime);
        }
    });

    audio.addEventListener("loadedmetadata", () => {
        if (playMode === "audio") {
            txtDuration.textContent = formatTime(audio.duration);
        }
    });

    audio.addEventListener("ended", () => {
        if (playMode === "audio") {
            nextTrack();
        }
    });

    // Seek track progress
    trackerProgress.addEventListener("input", () => {
        if (playMode === "youtube") {
            if (ytPlayer && typeof ytPlayer.seekTo === 'function') {
                const duration = ytPlayer.getDuration();
                if (duration) {
                    const time = (trackerProgress.value / 100) * duration;
                    ytPlayer.seekTo(time, true);
                }
            }
        } else {
            if (audio.duration) {
                const time = (trackerProgress.value / 100) * audio.duration;
                audio.currentTime = time;
            }
        }
    });

    // Volume adjustment
    valVolume.addEventListener("input", () => {
        const vol = valVolume.value / 100;
        audio.volume = vol;
        if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
            ytPlayer.setVolume(vol * 100);
        }
        
        if (vol === 0) {
            btnMute.className = "fa-solid fa-volume-xmark text-[10px] text-red-400 cursor-pointer w-4";
            isMuted = true;
        } else {
            btnMute.className = "fa-solid fa-volume-high text-[10px] text-gray-400 cursor-pointer w-4";
            isMuted = false;
            prevVolume = vol;
        }
    });

    // Mute click
    btnMute.addEventListener("click", () => {
        if (isMuted) {
            audio.volume = prevVolume;
            if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
                ytPlayer.setVolume(prevVolume * 100);
            }
            valVolume.value = prevVolume * 100;
            btnMute.className = "fa-solid fa-volume-high text-[10px] text-gray-400 cursor-pointer w-4";
            isMuted = false;
        } else {
            prevVolume = audio.volume || 0.8;
            audio.volume = 0;
            if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
                ytPlayer.setVolume(0);
            }
            valVolume.value = 0;
            btnMute.className = "fa-solid fa-volume-xmark text-[10px] text-red-400 cursor-pointer w-4";
            isMuted = true;
        }
    });

    // Toggle panel visibility
    let isPanelOpen = false;
    function togglePanel() {
        if (isPanelOpen) {
            panel.classList.remove("scale-100", "opacity-100");
            panel.classList.add("scale-0", "opacity-0");
            isPanelOpen = false;
        } else {
            panel.classList.remove("scale-0", "opacity-0");
            panel.classList.add("scale-100", "opacity-100");
            isPanelOpen = true;
        }
    }

    btnTogglePanel.addEventListener("click", togglePanel);
    btnClose.addEventListener("click", togglePanel);

    // Toggle playlist show/hide
    let isPlaylistOpen = false;
    btnListToggle.addEventListener("click", () => {
        if (isPlaylistOpen) {
            listPlaylist.classList.add("hidden");
            btnListToggle.style.color = "";
            isPlaylistOpen = false;
        } else {
            listPlaylist.classList.remove("hidden");
            btnListToggle.style.color = "#fbbf24";
            isPlaylistOpen = true;
        }
    });

    // 7. Initialize
    renderPlaylist();
    loadTrack(0);
});
