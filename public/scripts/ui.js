// ui.js (Phiên bản Nâng cấp - Chỉ xử lý giao diện)
const GEMINI_API_KEY = 'AIzaSyCEeQKXZzDAvUQVlHdnNZ9ZvrkCGJN9Abc';

window.loadComponent = async function(componentPath, targetElementId) {
    const target = document.getElementById(targetElementId);
    if (!target) {
        console.error(`Lỗi: Không tìm thấy phần tử target ID: ${targetElementId}`);
        return;
    }
    try {
        const response = await fetch(componentPath);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const html = await response.text();
        target.innerHTML = html;
        console.log(`Đã tải thành công component: ${componentPath}`);

        // Đặc biệt: Sau khi load sidebar, gọi hàm khởi tạo logic
        if (targetElementId === 'sidebar') {
            // Đảm bảo Trang chủ được kích hoạt ngay sau khi sidebar load
            if (window.switchTab && window.loadUserPlaylists) {
                // switchTab('home') sẽ gọi loadUserPlaylists()
                window.loadUserPlaylists(); 
            }
        } 
        
        // 🚀 THÊM LOGIC KHỞI TẠO PLAYER BAR TẠI ĐÂY 🚀
        if (targetElementId === 'playerBar') {
            if (window.initializePlayerControls) {
                window.initializePlayerControls();
                console.log('Player controls initialized after loading component.');
            } else {
                console.error('Lỗi: Hàm initializePlayerControls chưa được load (Kiểm tra app.js).');
            }
        }
        // -----------------------------------------------------------------

    } catch (error) {
        console.error(`Lỗi tải component ${componentPath}:`, error);
    }
};
// Hàm quản lý việc chuyển đổi nội dung chính (SPA Routing)
window.switchTab = function (tabName, playlistId = null) {
    const mainSections = document.querySelectorAll('#mainContentArea .main-section'); 
    
    const navLinks = document.querySelectorAll('.sidebar-left .menu-item'); 

    // 1. Ẩn tất cả sections
    let sectionFound = false;
    const targetId = tabName + '-section'; // Ví dụ: 'home-section', 'search-section'

    mainSections.forEach(section => {
        if (section.id === targetId) {
            // 2. HIỂN THỊ section mục tiêu
            section.style.display = 'block';
            sectionFound = true;
        } else {
            // ẨN TẤT CẢ sections khác
            section.style.display = 'none';
        }
    });

    if (!sectionFound) {
        console.warn(`Section "${targetId}" không tồn tại trong vùng chứa nội dung.`);
        return; // Ngừng thực thi nếu section không được tìm thấy
    }

    // Xử lý logic đặc biệt sau khi chuyển tab (Giữ nguyên)
    if (tabName === 'detail-playlist' && playlistId && window.loadDetailPlaylist) {
        window.loadDetailPlaylist(playlistId);
    } else if (tabName === 'uploads' && window.loadMyUploads) {
        window.loadMyUploads(true);
    } else if (tabName === 'recommend' && window.loadRecommendations) {
        window.loadRecommendations();
    } 
    
    // Cập nhật trạng thái Active trên Sidebar
    navLinks.forEach(link => {
        // Dùng data-section attribute để xác định tab mục tiêu
        const linkTarget = link.getAttribute('data-section');
        
        if (linkTarget === tabName) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
};

// Cập nhật nội dung thanh phát nhạc (giữ nguyên, nhưng không cần import từ app.js)
// window.playNextTrack = async function () { 
//     if (repeatMode === 'one') {
//         window.updatePlayerBar(currentPlaylist[currentTrackIndex]);  
//         window.appFunctions.playTrack(currentPlaylist[currentTrackIndex]);
//         return;
//     }

//     if (currentPlaylist.length === 1) {
//         currentTrackIndex = 0;  // Stay, but since repeat off, next will trigger random recs
//     }

//     // Existing logic for empty or normal next (giữ, nhưng add reset shuffle nếu not shuffling)
//     if (currentPlaylist.length === 0) {
//         console.log('No playlist - loading recs for random next');
//         const user = (await supabase.auth.getUser()).data.user;
//         if (!user) return;

//         if (!cachedRecommendedTracks || cachedRecommendedTracks.length === 0) {
//             try {
//                 const { data: tracks, error } = await supabase
//                     .rpc('get_unique_recommendations', { limit_count: 20 });
//                 if (error) throw error;
//                 cachedRecommendedTracks = tracks || [];
//             } catch (error) {
//                 console.error('Lỗi load recs for random:', error);
//                 isPlaying = false;
//                 return;
//             }
//         }

//         const recs = cachedRecommendedTracks;
//         if (recs.length === 0) {
//             console.log('No recs available - stopping playback');
//             isPlaying = false;
//             return;
//         }

//         const randomIndex = Math.floor(Math.random() * recs.length);
//         currentPlaylist = recs;
//         currentTrackIndex = randomIndex;
//         const randomTrack = recs[randomIndex];
        
//         console.log(`Auto-playing random rec: ${randomTrack.title}`);
//         window.appFunctions.playTrack(randomTrack);
//         return;
//     }

//     let nextIndex;
//     if (isShuffling) {
//         let currentShuffleIndex = shuffleOrder.indexOf(currentTrackIndex);
//         currentShuffleIndex = (currentShuffleIndex + 1) % currentPlaylist.length;
//         nextIndex = shuffleOrder[currentShuffleIndex];
//     } else {
//         nextIndex = (currentTrackIndex + 1) % currentPlaylist.length;
//         // FIX: Reset shuffle if not shuffling
//         shuffleOrder = [];
//     }

//     currentTrackIndex = nextIndex;
//     const track = currentPlaylist[nextIndex];
//     window.appFunctions.playTrack(track);
// };

window.updatePlayerBar = function(track) {
    const cover = document.getElementById('trackCover');
    const title = document.getElementById('trackTitle');
    const artist = document.getElementById('trackArtist');

    if (cover) {
        if (track.cover_url && track.cover_url.trim() !== '') {
            cover.src = track.cover_url;
            cover.alt = track.title || 'Track cover';
            cover.style.display = 'block';
        } else {
            cover.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRUVFRUVFIi8+CjxwYXRoIGQ9Ik0yMCAxMkMxNS41ODQgMTIgMTIgMTUuNTg0IDEyIDIwQzEyIDI0LjQxNiAxNS41ODQgMjggMjAgMjhDMjQuNDE2IDI4IDI4IDI0LjQxNiAyOCAyMEMyOCAxNS41ODQgMjQuNDE2IDEyIDIwIDEyWk0yMi41IDIxLjI1TDE5IDIzVjE3SDIyLjVWMjEuMjVaIiBmaWxsPSIjOTk5OTk5Ii8+Cjwvc3ZnPgo=';
            cover.alt = 'No cover';
            cover.style.display = 'block';
        }
    }

    if (title) title.textContent = track.title || 'Unknown Title';
    if (artist) artist.textContent = track.artist || 'Unknown Artist';

    const rightPanel = document.getElementById('sidebar-right');
    if (!rightPanel) {
        console.warn('sidebar-right not found - check HTML');
        return;
    }

    if (track) {
        rightPanel.classList.add('active');
    } else {
        rightPanel.classList.remove('active');
    }

    if (!track) {
        rightPanel.innerHTML = `
            <div class="right-panel-content">
                <div class="right-panel-placeholder">
                    <div class="placeholder-cover">🎵</div>
                    <p>Chọn bài hát để xem chi tiết</p>
                    <small>Playlist: Danh sách phát cá nhân</small>
                </div>
            </div>
        `;
        return;
    }

    // Render nội dung chính
    rightPanel.innerHTML = `
        <div class="right-panel-content">
            <div class="current-playlist-header">${window.currentPlaylistSource || 'Gợi ý cho bạn'}</div>
            <img src="${track.cover_url || '/assets/default-cover.webp'}" 
                 alt="${track.title} cover" 
                 class="track-cover-large" 
                 onerror="this.src='/assets/default-cover.webp'">
            <div class="track-title-large">${track.title || 'Unknown Title'}</div>
            <div class="track-artist-large">${track.artist || 'Unknown Artist'}</div>
            
            <div id="nextTrackContainer" class="next-track-preview"></div>
            <div id="lyricsContainer" class="lyrics-container lyrics-loading">Đang tải lời bài hát...</div>
        </div>
    `;

    // Thêm khối chat AI bên dưới lyrics
    const chatSection = `
        <div id="aiChatSection" class="ai-chat-section">
            <h4>Hỏi thêm về bài hát!</h4>
            <div id="chatMessages" class="chat-messages"></div>
            <div class="chat-input-container">
                <input type="text" id="chatInput" placeholder="Hỏi về ${track.title} (e.g., Ý nghĩa lời bài hát?)" />
                <button id="sendChatBtn" onclick="sendAIQuery('${track.id}', '${track.title}', '${track.artist}')">
                    <i class="fas fa-paper-plane"></i> Gửi
                </button>
            </div>
        </div>
    `;
    rightPanel.insertAdjacentHTML('beforeend', chatSection);

    // Gắn sự kiện Enter cho ô nhập
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendAIQuery(track.id, track.title, track.artist);
        });
    }

    // Gọi các hàm phụ trợ
    getNextTrackPreview().then(nextTrack => {
        const nextHtml = nextTrack ? `
            <div class="next-track-preview">
                <h4>Bài hát tiếp theo</h4>
                <div class="next-track-info">${nextTrack.title} - ${nextTrack.artist}</div>
            </div>
        ` : '<div class="next-track-preview"><p>Không có bài tiếp theo</p></div>';
        document.getElementById('nextTrackContainer').innerHTML = nextHtml;
    });

    getSongInfo(track);
    fetchLyrics(track);
};

window.sendAIQuery = async function(trackId, title, artist) {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendChatBtn');
    const messages = document.getElementById('chatMessages');
    
    if (!input || !input.value.trim()) return;
    
    const userMessage = input.value.trim();
    input.value = '';
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang hỏi...';
    
    // Add user message
    const userDiv = document.createElement('div');
    userDiv.className = 'chat-message user';
    userDiv.textContent = userMessage;
    messages.appendChild(userDiv);
    messages.scrollTop = messages.scrollHeight;
    
    try {
        const GROQ_API_KEY = process.env.GROQ_API_KEY
        if (!GROQ_API_KEY || GROQ_API_KEY.includes('your')) {
            throw new Error('API key chưa cấu hình - Lấy key miễn phí tại console.groq.com');
        }
        
        // Prompt tối ưu
        const prompt = `Bạn là chuyên gia âm nhạc. Trả lời ngắn gọn, hấp dẫn về bài hát "${title}" của ${artist}. Câu hỏi: ${userMessage}. Chỉ trả lời bằng tiếng Việt, dưới 200 từ.`;
        
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',  // ✅ FIX: Model thay thế (miễn phí, nhanh, không deprecate)
                messages: [
                    { role: 'system', content: 'Bạn là trợ lý âm nhạc thân thiện, trả lời bằng tiếng Việt.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 300,
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Groq full error:', errorText);
            throw new Error(`API error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('📦 Full Groq response:', data);  // Debug
        
        if (!data || !data.choices || data.choices.length === 0) {
            throw new Error('No response – check quota/key');
        }
        
        let text = data.choices[0]?.message?.content || '';
        if (!text.trim()) {
            console.warn('Empty text from Groq:', data);
            throw new Error('Response empty – check prompt/key/quota');
        }
        
        // Add AI response
        const aiDiv = document.createElement('div');
        aiDiv.className = 'chat-message ai';
        aiDiv.innerHTML = text.replace(/\n/g, '<br>');
        messages.appendChild(aiDiv);
        messages.scrollTop = messages.scrollHeight;
        
        console.log('✅ AI response for:', userMessage);
        
    } catch (error) {
        console.error('AI query error:', error);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'chat-message ai';
        errorDiv.style.color = 'var(--danger-color)';
        errorDiv.textContent = `Lỗi: ${error.message}. Thử lại sau!`;
        messages.appendChild(errorDiv);
        messages.scrollTop = messages.scrollHeight;
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi';
    }
};

async function getSongInfo(track) {
    const container = document.getElementById('songInfoContainer');
    if (!container) return;

    // container.innerHTML = '<p>Đang tải thông tin bài hát...</p>';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
        const query = encodeURIComponent(`${track.artist} ${track.title}`);
        const response = await fetch(`https://musicbrainz.org/ws/2/recording/?query="${query}"&fmt=json&limit=1`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error('API fail');
        const data = await response.json();
        if (data.count > 0 && data.recordings[0]) {
            const recording = data.recordings[0];
            const info = `
                <strong>Thể loại:</strong> ${recording['genres']?.map(g => g.name).join(', ') || 'Unknown'}<br>
                <strong>Ngày phát hành:</strong> ${recording['first-release-date'] || 'Unknown'}<br>
                <strong>Mô tả:</strong> ${recording.artist-credit[0]?.name || 'N/A'} - Một ca khúc nổi bật từ album ${recording.releases?.[0]?.title || 'N/A'}.
            `;
            container.innerHTML = info;
            return;
        }
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.warn('Song info timeout - fallback to mock');
        } else {
            console.warn('Song info fetch fail (fallback to mock):', error.message);
        }
    }

}

function generateMockLyrics(title, artist) {
    const lines = [
        `[Verse 1]\nIn the rhythm of ${title}, we find our way,`,
        `\n${artist}'s melody, lighting up the day.`,
        `\n[Chorus]\nOh, ${title}, take me higher,`,
        `With your sound, set my soul on fire.`,
        `\n[Verse 2]\nWhispers of the night, in every note we hear,`,
        `${title} forever, drawing us near.`
    ];
    return lines.join('\n') + `\n\n*(Mock lyrics - Use real API for full verses)*`;
}

async function fetchLyrics(track) {
    const container = document.getElementById('lyricsContainer');
    if (!container) return;

    const cacheKey = `lyrics_${track.artist}_${track.title}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        container.textContent = cached;
        container.classList.remove('lyrics-loading');
        return;
    }

    container.textContent = 'Đang tải lời bài hát...';
    container.classList.add('lyrics-loading');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);  // Tăng timeout lên 15s cho ovh

    try {
        // Primary: Lyrics.ovh
        const artist = encodeURIComponent(track.artist || 'Unknown');
        const title = encodeURIComponent(track.title || 'Unknown');
        const response = await fetch(`https://api.lyrics.ovh/v1/${artist}/${title}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error('No lyrics from ovh');
        const data = await response.json();
        let lyrics = data.lyrics || null;
        
        if (lyrics && lyrics.trim() !== '') {
            lyrics = lyrics.replace(/\n\s*\n/g, '\n\n').trim();
            container.textContent = lyrics;
            localStorage.setItem(cacheKey, lyrics);
            container.classList.remove('lyrics-loading');
            console.log('✅ ovh lyrics for:', track.title);
            return;
        } else {
            throw new Error('ovh empty - fallback Genius');
        }
        
    } catch (error) {
        clearTimeout(timeoutId);
        console.warn('Lyrics.ovh failed:', error.message);
        
        // Fallback: Genius với proxy
        try {
            const geniusKey = 'IxVXGHsLgddA9h0Po19AjKMezA4xvvKJ5uQ0CiDfpK9oFPrBXE3dr43iaeCbRlFG';  // Giữ key cũ
            const searchQuery = encodeURIComponent(`${track.title} ${track.artist} lyrics`);  
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(`https://api.genius.com/search?q=${searchQuery}`)}`;
            const geniusResponse = await fetch(proxyUrl);
            if (!geniusResponse.ok) throw new Error('Proxy/Genius failed: ' + geniusResponse.status);
            const geniusData = await geniusResponse.json();
            
            if (!geniusData.response || !geniusData.response.hits || geniusData.response.hits.length === 0) {
                throw new Error('No Genius match for song');
            }
            
            const hit = geniusData.response.hits[0];
            const lyricsUrl = hit.result.url;
            
            const lyricsProxyUrl = `https://corsproxy.io/?${encodeURIComponent(lyricsUrl)}`;
            const lyricsResponse = await fetch(lyricsProxyUrl);
            if (!lyricsResponse.ok) throw new Error('Proxy lyrics failed: ' + lyricsResponse.status);
            const lyricsHtml = await lyricsResponse.text();
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(lyricsHtml, 'text/html');
            const lyricsContent = doc.querySelector('.Lyrics__Lyrics__Content');
            if (!lyricsContent) throw new Error('Lyrics element not found');
            
            const lineElements = lyricsContent.querySelectorAll('.Lyrics__Line');
            let lyrics = Array.from(lineElements).map(line => line.innerText.trim()).join('\n');
            
            if (lyrics && lyrics.trim() !== '') {
                lyrics = lyrics.replace(/\n\s*\n/g, '\n\n').replace(/\[.*?\]/g, '').trim();
                container.textContent = lyrics;
                localStorage.setItem(cacheKey, lyrics);
                container.classList.remove('lyrics-loading');
                console.log('✅ Genius lyrics for:', track.title);
                return;
            }
            throw new Error('Genius lyrics empty - no more fallbacks');
        } catch (geniusError) {
            console.warn('Genius failed:', geniusError.message);
            // ✅ FIX: Chỉ hiển thị message đơn giản, không AI
            const noLyricsMsg = `Chưa có lời cho bài hát "${track.title}" của ${track.artist}.`;
            container.textContent = noLyricsMsg;
            localStorage.setItem(cacheKey, noLyricsMsg);  // Cache message để tránh spam request
            container.classList.remove('lyrics-loading');
            console.log('❌ No lyrics found for:', track.title);
        }
    }
}

async function fetchLyricsFromGenius(track, container, cacheKey) {
    try {
        const searchQuery = encodeURIComponent(`${track.title} ${track.artist}`);
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://api.genius.com/search?q=${searchQuery}`)}`;
        const geniusResponse = await fetch(proxyUrl);
        if (!geniusResponse.ok) throw new Error('Không thể truy cập Genius qua proxy');

        const proxyData = await geniusResponse.json();
        const geniusData = JSON.parse(proxyData.contents);
        const hit = geniusData.response?.hits?.[0];
        const lyricsUrl = hit?.result?.url;
        if (!lyricsUrl) throw new Error('Không tìm thấy URL lời bài hát');

        const lyricsProxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(lyricsUrl)}`;
        const lyricsResponse = await fetch(lyricsProxyUrl);
        if (!lyricsResponse.ok) throw new Error('Không thể tải nội dung lời bài hát');

        const lyricsHtml = (await lyricsResponse.json()).contents;
        const doc = new DOMParser().parseFromString(lyricsHtml, 'text/html');
        const lyricsContent = doc.querySelector('.Lyrics__Lyrics__Content');
        if (!lyricsContent) throw new Error('Không tìm thấy phần lời bài hát');

        const lines = Array.from(lyricsContent.querySelectorAll('.Lyrics__Line')).map(line => line.innerText.trim());
        let lyrics = lines.join('\n').replace(/\n\s*\n/g, '\n\n').replace(/\[.*?\]/g, '').trim();

        if (lyrics) {
            container.textContent = lyrics;
            localStorage.setItem(cacheKey, lyrics);
            container.classList.remove('lyrics-loading');
            console.log('✅ Lấy lời từ Genius:', track.title);
            return;
        }
        throw new Error('Lời bài hát từ Genius rỗng');
    } catch (error) {
        console.warn('❌ Genius thất bại:', error.message);
        container.textContent = `🚫 Không tìm thấy lời bài hát cho "${track.title}" của ${track.artist}.\n\n👉 Thử bài hát phổ biến hơn hoặc kiểm tra kết nối.`;
        container.classList.remove('lyrics-loading');
    }
}

async function getNextTrackPreview() {
    if (currentPlaylist.length === 0) return null;
    let nextIndex = (currentTrackIndex + 1) % currentPlaylist.length;
    if (isShuffling) {
        let shuffleIdx = shuffleOrder.indexOf(currentTrackIndex);
        shuffleIdx = (shuffleIdx + 1) % currentPlaylist.length;
        nextIndex = shuffleOrder[shuffleIdx];
    }
    return currentPlaylist[nextIndex] || null;
}

document.addEventListener('DOMContentLoaded', () => {
    // Gọi nhúng Sidebar
    window.loadComponent('/components/sidebar.html', 'sidebar');
    // Giả sử player-bar.html được nhúng vào footer
    window.loadComponent('/components/player-bar.html', 'playerBar'); 
    window.loadComponent('/home-content.html', 'mainContentArea');
});

window.updatePlayerBar = updatePlayerBar;
window.fetchLyrics = fetchLyrics; 
window.getNextTrackPreview = getNextTrackPreview;
window.getSongInfo = getSongInfo;