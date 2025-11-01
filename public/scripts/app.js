// app.js
import { supabase } from '../supabase/client.js';

console.log('✅ App.js loaded');
console.log('✅ Supabase instance:', supabase ? 'Connected' : 'Not connected');

console.log('📄 Script loaded:', window.location.href);

let currentAudio = null;
let isPlaying = false;
let currentTrackIndex = 0;
let currentPlaylist = [];
let volume = 0.5;

let isShuffling = false; 
let repeatMode = 'off'; 
let shuffleOrder = []; 

let cachedPlaylists = null;
let cachedHistoryTracks = null;
let cachedRecommendedTracks = null;
let cachedProfile = null;
let cachedPlaylistTracks = null;
let cachedMyUploads = null;

let isTransitioning = false;
const FALLBACK_COVER = '/assets/default-cover.webp';
let recentlyPaused = false;
window.isPlaying = isPlaying;

window.appFunctions = window.appFunctions || {};

console.log('✅ appFunctions initialized');

window.currentPlaylists = window.currentPlaylists || {};

function initializePlayerControls() {
    document.getElementById('playPauseBtn').addEventListener('click', togglePlayPause);
    document.getElementById('prevBtn').addEventListener('click', playPreviousTrack);
    document.getElementById('nextBtn').addEventListener('click', playNextTrack);

    const volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
        volumeSlider.addEventListener('input', handleVolumeChange);
    }

    if (volumeSlider) {
        volumeSlider.value = volume * 100;
    }

    document.getElementById('progressBar').addEventListener('input', handleProgressChange);
    document.getElementById('shuffleBtn').addEventListener('click', toggleShuffle);
    document.getElementById('repeatBtn').addEventListener('click', toggleRepeat);

    document.addEventListener('keydown', handleKeyboardShortcuts);

    console.log('Player controls initialized');
}

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        console.log(`Modal ${modalId} closed.`);
    } else {
        console.warn(`Attempted to close non-existent modal: ${modalId}`);
    }
};

function togglePlayPause() {
    if (isTransitioning) return;  
    isTransitioning = true;
    setTimeout(() => { isTransitioning = false; }, 300);

    const playPauseBtn = document.getElementById('playPauseBtn');
    
    if (!currentAudio) {
        if (currentPlaylist.length > 0) {
            playTrack(currentPlaylist[currentTrackIndex]);
        }
        isTransitioning = false;
        return;
    }

    const playIcon = playPauseBtn ? playPauseBtn.querySelector('i') : null;  
    
    if (isPlaying) {
        currentAudio.pause();
        recentlyPaused = true;
        setTimeout(() => { recentlyPaused = false; }, 500);
        if (playIcon) {
            playIcon.className = 'fas fa-play';  
        }
    } else {
        currentAudio.play().catch(error => {
            if (error.name === 'AbortError' || error.message.includes('interrupted by a call to pause()') || (typeof recentlyPaused !== 'undefined' && recentlyPaused)) {
                console.warn('Play interrupted by pause - ignoring (debounced)');
                if (recentlyPaused) recentlyPaused = false;  
                return;  
            }
            console.error('Play failed:', error);
            console.log('Lỗi phát nhạc: ' + error.message);
        }).then(() => {
            // FIX: Refresh UI & progress sau play success
            if (currentAudio.track) {
                window.updatePlayerBar(currentAudio.track);
            }
            updateProgressBar();  
            setTimeout(updateProgressBar, 100);  
        });
        if (playIcon) {
            playIcon.className = 'fas fa-pause';  
        }
    }
    isPlaying = !isPlaying;
}

function handleVolumeChange(e) {
    volume = e.target.value / 100;
    if (currentAudio) {
        currentAudio.volume = volume;
    }
}

function handleProgressChange(e) {
    if (currentAudio && currentAudio.duration) {
        const seekTime = (e.target.value / 100) * currentAudio.duration;
        currentAudio.currentTime = seekTime;
    }
}

function handleKeyboardShortcuts(e) {
    if (e.target.tagName === 'INPUT') return;

    switch(e.code) {
        case 'Space':
            e.preventDefault();
            togglePlayPause();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            seek(-10);
            break;
        case 'ArrowRight':
            e.preventDefault();
            seek(10);
            break;
        case 'ArrowUp':
            e.preventDefault();
            increaseVolume();
            break;
        case 'ArrowDown':
            e.preventDefault();
            decreaseVolume();
            break;
    }
}

function seek(seconds) {
    if (currentAudio) {
        currentAudio.currentTime += seconds;
    }
}

function increaseVolume() {
    volume = Math.min(1, volume + 0.1);
    if (currentAudio) {
        currentAudio.volume = volume;
    }
    const volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
        volumeSlider.value = volume * 100;
    }
}

function decreaseVolume() {
    volume = Math.max(0, volume - 0.1);
    if (currentAudio) {
        currentAudio.volume = volume;
    }
    const volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
        volumeSlider.value = volume * 100;
    }
}

function updateProgressBar() {
    const progressBar = document.getElementById('progressBar');
    const currentTimeEl = document.getElementById('currentTime');
    const durationEl = document.getElementById('duration');

    if (currentAudio && progressBar) {
        const progress = (currentAudio.currentTime / currentAudio.duration) * 100 || 0;
        progressBar.value = progress;

        if (currentTimeEl) currentTimeEl.textContent = formatTime(currentAudio.currentTime);
        if (durationEl && isFinite(currentAudio.duration)) durationEl.textContent = formatTime(currentAudio.duration);
    }
}

async function updateProfileDisplay(user, forceRefresh = false) { 
    const defaultAvatarUrl = '/assets/default-avatar.png'; 
    const headerUserElement = document.getElementById('userName'); 
    const headerAvatarElement = document.getElementById('userAvatar');
    const profileModalAvatar = document.getElementById('currentAvatarPreview');

    let profile = await loadProfile(user.id, forceRefresh);
    
    const username = profile?.username || 'User Name';
    
    if (headerUserElement) {
        headerUserElement.textContent = username;
    }

    let finalAvatarUrl = defaultAvatarUrl;

    if (profile?.avatar_url) {
        if (profile.avatar_url.includes('supabase.co') || profile.avatar_url.startsWith('http')) {
            finalAvatarUrl = profile.avatar_url;
        } else {
            const { data: avatarData } = supabase.storage
                .from('avatars')
                .getPublicUrl(profile.avatar_url);
            if (avatarData?.publicUrl) {
                finalAvatarUrl = avatarData.publicUrl;
            }
        }
    }
    
    if (headerAvatarElement) {
        headerAvatarElement.src = finalAvatarUrl;
    }
    if (profileModalAvatar) {
        profileModalAvatar.src = finalAvatarUrl;
    }
    
    const profileUsernameInput = document.getElementById('editUsername');
    if (profileUsernameInput && profile) {
        profileUsernameInput.value = profile.username || '';
    }
    
    const profileBirthdayInput = document.getElementById('editBirthday');
    if (profileBirthdayInput && profile) {
        profileBirthdayInput.value = profile.birthday || '';
    }
};

async function loadProfile(userId) {
    if (cachedProfile) return cachedProfile;

    const { data, error } = await supabase
        .from('users')
        .select('username, birthday, avatar_url')
        .eq('id', userId)
        .single();
        
    if (error) throw error;
    
    cachedProfile = data;
    return data;
}

function getPublicAvatarUrl(avatarPath) {
    if (!avatarPath) return '/assets/default-avatar.png';
    if (avatarPath.includes('supabase.co') || avatarPath.startsWith('http')) return avatarPath;
    const { data } = supabase.storage.from('avatars').getPublicUrl(avatarPath);
    return data?.publicUrl || '/assets/default-avatar.png';
}

async function uploadAvatar(userId, avatarFile) {
    const BUCKET_NAME = 'avatars'; 
    
    const fileExt = avatarFile.name.split('.').pop();
    const filePath = `${userId}/${Date.now()}_avatar.${fileExt}`; 

    try {
        console.log('Starting avatar upload to path:', filePath);
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, avatarFile, {
                cacheControl: '3600',
                upsert: true, 
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            return null;
        }

        console.log('Upload data:', uploadData);

        const { data: publicUrlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);

        console.log('Public URL:', publicUrlData.publicUrl);

        return publicUrlData.publicUrl;

    } catch (error) {
        console.error('System error during upload:', error);
        return null;
    }
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

window.playTrack = function (track, playlist = currentPlaylist, index = -1) {
    if (!track || !track.file_url) {
        console.error('Lỗi: Thông tin track không hợp lệ hoặc thiếu file_url.');
        return;
    }

    // FIX: Pause & clear old audio + REMOVE PRELOAD LISTENERS nếu attached
    if (currentAudio) {
        currentAudio.pause();
        if (window.preloadListenersAttached) {
            currentAudio.removeEventListener('loadedmetadata', window.preloadOnLoadedMetadata);
            currentAudio.removeEventListener('timeupdate', window.preloadOnTimeUpdate);
            currentAudio.removeEventListener('ended', window.preloadOnEnded);
            currentAudio.removeEventListener('error', window.preloadOnError);
            window.preloadListenersAttached = false;  // Clear flag
            console.log('Removed preload listeners');
        }
        currentAudio = null;
    }

    // Set playlist & index
    if (playlist.length > 0) {
        currentPlaylist = playlist;
        currentTrackIndex = (index !== -1) ? index : currentPlaylist.findIndex(t => t.id === track.id) || 0;
        
        if (isShuffling) {
            generateShuffleOrder();
        }
    }

    // Named functions cho listeners (dễ remove)
    function onLoadedMetadata() {
        console.log('Track loaded:', track.title, 'Duration:', this.duration);
        updateProgressBar();
    }
    function onTimeUpdate() {
        updateProgressBar();
    }
    function onEnded() {
        isPlaying = false;
        const playPauseBtn = document.getElementById('playPauseBtn');
        const playIcon = playPauseBtn ? playPauseBtn.querySelector('i') : null;
        if (playIcon) {
            playIcon.className = 'fas fa-play';  
        } else if (playPauseBtn) {
            playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        }
        
        if (currentPlaylist.length > 0) {
            setTimeout(window.playNextTrack, 1000);
        }
    }
    function onCanPlay() {
        console.log('Audio ready to play');
        currentAudio.play().catch(playError => {
            if (playError.name === 'AbortError' || playError.message.includes('interrupted by a call to pause()') || recentlyPaused) {
                console.warn('Play interrupted in playTrack - ignoring');
                return;
            }
            console.error('Play failed after canplay:', playError);
            throw playError;
        });
    }
    function onError(e) {
        console.error('Audio load error (retry ' + (retryCount + 1) + '):', e);
        throw e;
    }

    // Async attemptPlay (giữ nguyên, add listeners sau cleanup)
    async function attemptPlay() {
        let retryCount = 0;
        const maxRetries = 3;
        let success = false;

        while (retryCount < maxRetries && !success) {
            try {
                let audioUrl = track.file_url;
                if (audioUrl.includes('supabase.co')) {
                    const ts = Date.now();
                    const rand = Math.random().toString(36).substring(7);
                    audioUrl += (audioUrl.includes('?') ? '&' : '?') + `t=${ts}&r=${rand}`;
                }

                currentAudio = new Audio(audioUrl);
                currentAudio.track = track;
                currentAudio.volume = volume;
                currentAudio.preload = 'auto';
                currentAudio.crossOrigin = 'anonymous';

                if (retryCount === 0) {
                    currentAudio.addEventListener('loadedmetadata', onLoadedMetadata);
                    currentAudio.addEventListener('timeupdate', onTimeUpdate);
                    currentAudio.addEventListener('ended', onEnded);
                    currentAudio.addEventListener('canplay', onCanPlay);
                }

                currentAudio.addEventListener('error', onError);

                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Load timeout')), 3000);

                    currentAudio.addEventListener('canplay', () => {
                        clearTimeout(timeout);
                        success = true;
                        isPlaying = true;
                        resolve();
                    }, { once: true });

                    currentAudio.addEventListener('error', () => {
                        clearTimeout(timeout);
                        reject(new Error('Load error'));
                    }, { once: true });
                });

            } catch (error) {
                retryCount++;
                if (retryCount < maxRetries) {
                    console.log(`Retrying audio load (${retryCount}/${maxRetries})...`);
                    await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                    console.error('Max retries exceeded for track:', track.title);
                    alert('Lỗi tải file nhạc: Không thể phát sau ' + maxRetries + ' lần thử. Thử track khác.');
                    currentAudio = null;
                    isPlaying = false;
                    return;
                }
            }
        }

        if (success) {
            window.updatePlayerBar(track);
            
            const playPauseBtn = document.getElementById('playPauseBtn');
            const playIcon = playPauseBtn ? playPauseBtn.querySelector('i') : null;
            if (playIcon) {
                playIcon.className = 'fas fa-pause';  
            } else if (playPauseBtn) {
                playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>'; 
            }

            console.log('Now playing:', track.title, 'by', track.artist); 
            updatePlayHistory(track.id);

            if (typeof window.fetchLyrics === 'function') {
                window.fetchLyrics(track);
            }
        }
    }

    attemptPlay();
};


window.playNextTrack = async function () { 
    if (repeatMode === 'one') {
        window.appFunctions.playTrack(currentPlaylist[currentTrackIndex]);
        return;
    }

    // FIX: Nếu currentPlaylist empty, load recs random
    if (currentPlaylist.length === 0) {
        console.log('No current playlist - loading recommendations for random next');
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) return;

        if (!cachedRecommendedTracks || cachedRecommendedTracks.length === 0) {
            try {
                const { data: tracks, error } = await supabase
                    .rpc('get_unique_recommendations', { limit_count: 20 });
                if (error) throw error;
                cachedRecommendedTracks = tracks || [];
            } catch (error) {
                console.error('Lỗi load recommendations for random:', error);
                isPlaying = false;
                return;
            }
        }

        const recs = cachedRecommendedTracks;
        if (recs.length === 0) {
            console.log('No recommendations available - stopping playback');
            isPlaying = false;
            return;
        }

        // FIX: Enable shuffle temporarily for true random nexts
        if (!isShuffling) {
            isShuffling = true;
            generateShuffleOrder(); // Shuffle the order
            console.log('Auto-enabled shuffle for recs fallback');
        }

        const randomIndex = Math.floor(Math.random() * recs.length);
        currentPlaylist = recs;
        currentTrackIndex = randomIndex;
        const randomTrack = recs[randomIndex];
        
        console.log(`Auto-playing random recommendation: ${randomTrack.title} (shuffled mode)`);
        window.appFunctions.playTrack(randomTrack);
        return;
    }

    let nextIndex;
    if (isShuffling) {
        let currentShuffleIndex = shuffleOrder.indexOf(currentTrackIndex);
        currentShuffleIndex = (currentShuffleIndex + 1) % currentPlaylist.length;
        nextIndex = shuffleOrder[currentShuffleIndex];
    } else {
        nextIndex = (currentTrackIndex + 1) % currentPlaylist.length;
        // FIX: Reset shuffle if not shuffling
        shuffleOrder = [];
    }

    currentTrackIndex = nextIndex;
    const track = currentPlaylist[nextIndex];
    window.appFunctions.playTrack(track);
    
    // FIX: Explicit icon update sau play (nếu onEnded không fire kịp)
    setTimeout(() => {
        const playPauseBtn = document.getElementById('playPauseBtn');
        const playIcon = playPauseBtn ? playPauseBtn.querySelector('i') : null;
        if (isPlaying && playIcon) {
            playIcon.className = 'fas fa-pause';  
        }
    }, 100);
};

async function getRecommendationsPlaylistId(userId) {
    if (window.cachedRecommendationsPlaylistId) return window.cachedRecommendationsPlaylistId;
    
    const { data: playlist, error } = await supabase
        .from('playlists')
        .select('id')
        .eq('user_id', userId)
        .eq('name', 'Recommendations')
        .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    if (!playlist) {
        const { data: newPlaylist } = await supabase
            .from('playlists')
            .insert([{ user_id: userId, name: 'Recommendations', color: '#ff6b6b' }])
            .select('id')
            .single();
        window.cachedRecommendationsPlaylistId = newPlaylist.id;
        return newPlaylist.id;
    }
    
    window.cachedRecommendationsPlaylistId = playlist.id;
    return playlist.id;
}

window.playPreviousTrack = function () {
    if (currentPlaylist.length === 0) return;
    
    currentTrackIndex = (currentTrackIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
    const track = currentPlaylist[currentTrackIndex];
    window.appFunctions.playTrack(track);
}

async function updatePlayHistory(trackId) {
    const { data: { user } } = await supabase.auth.getUser(); 
    if (!user) return;
    const userId = user.id;

    try {
        // SỬA: SELECT trước để lấy play_count hiện tại (manual +1, tránh raw())
        const { data: existing, error: selectError } = await supabase
            .from('history')
            .select('play_count')
            .eq('user_id', userId)
            .eq('track_id', trackId)
            .single();

        if (selectError && selectError.code !== 'PGRST116') {  
            console.error('Select history error:', selectError);
            return;
        }

        const currentCount = existing ? existing.play_count + 1 : 1;  

        const { data: upsertData, error: upsertError } = await supabase
            .from('history')
            .upsert(
                [{ 
                    user_id: userId, 
                    track_id: trackId, 
                    play_count: currentCount, 
                    played_at: new Date().toISOString() 
                }],
                { 
                    onConflict: 'user_id,track_id',  // Đảm bảo unique index tồn tại
                    ignoreDuplicates: false 
                }
            )
            .select('*')
            .single();

        if (upsertError) {
            console.error('Upsert history error:', upsertError);
            return;
        }

        console.log('History updated:', upsertData.play_count, 'plays for track', trackId);
    } catch (error) {
        console.error('System error updating history:', error);
    }
}

async function loadUserPlaylists(forceRefresh = false) {
    if (!window.playlistsLoadFlag) window.playlistsLoadFlag = false;  // Flag global
    if (window.playlistsLoadFlag && !forceRefresh) return;  // Skip nếu đang load
    window.playlistsLoadFlag = true;
    
    const user = (await supabase.auth.getUser()).data.user;
    const playlistGrid = document.getElementById('playlistGrid');
    if (!user || !playlistGrid) {
        window.playlistsLoadFlag = false;
        return;
    }
   
    if (cachedPlaylists && !forceRefresh) {
        displayPlaylists(cachedPlaylists);
        window.playlistsLoadFlag = false;
        return;
    }
    try {
        const { data: playlists, error } = await supabase
            .from('playlists')
            .select('id, name, icon, color, cover_url')
            .eq('user_id', user.id);
        if (error) throw error;
        cachedPlaylists = playlists;
       
        displayPlaylists(playlists);
    } catch (error) {
        console.error('❌ Lỗi tải Playlist:', error);
    } finally {
        window.playlistsLoadFlag = false;  // Reset flag
    }
}

function openPlaylistDetail(playlistId) {
    if (window.switchTab) {
        window.switchTab('detail-playlist', playlistId);
    } else {
        console.error('Không tìm thấy hàm switchTab.');
    }
}

function displayPlaylists(playlists) {
    const playlistGrid = document.getElementById('playlistGrid');
    if (!playlistGrid) return;
    playlistGrid.innerHTML = '';
    if (playlists.length === 0) {
        playlistGrid.innerHTML = '<p class="empty-message">Bạn chưa tạo danh sách phát nào.</p>';
        return;
    }
  
    playlists.forEach(playlist => {
        const playlistCard = document.createElement('div');
      
        playlistCard.className = 'playlist-card gradient-bg';
      
        const primaryColor = playlist.color || '#1db954'; // Fallback hex
        const secondaryColor = '#282828';
        console.log(`Rendering playlist "${playlist.name}": color=${primaryColor}, cover_url=${playlist.cover_url ? 'exists' : 'null'}`);
        
        playlistCard.style.setProperty('--card-primary-color', primaryColor);  // Optional var pass
        playlistCard.style.setProperty('--card-secondary-color', secondaryColor);

        // ← FIX: Declare & build backgroundStyle 1 lần, no duplicate set
        let backgroundStyle = `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%) !important`;  // ← THÊM !important inline để force override CSS
        if (playlist.cover_url) {
            const { data: coverData } = supabase.storage
                .from('cover')
                .getPublicUrl(playlist.cover_url);
            const coverUrl = coverData.publicUrl;
            if (coverUrl) {
                backgroundStyle = `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url(${coverUrl}) !important`;
                console.log(`Applied cover for "${playlist.name}": ${coverUrl}`);  // ← THÊM: Log để check nếu overlay set
            } else {
                console.warn(`Cover URL invalid for "${playlist.name}": ${playlist.cover_url} – check RLS read`);  // ← THÊM: Debug RLS
            }
        }
                
        playlistCard.style.background = backgroundStyle;  
        console.log(`Final background for "${playlist.name}": ${backgroundStyle}`);  
        
        playlistCard.style.backgroundSize = 'cover !important';
        playlistCard.style.backgroundPosition = 'center !important';
        playlistCard.style.color = 'white !important';
     
        playlistCard.innerHTML = `
            <div class="playlist-info">
                <h3>${playlist.name}</h3>
                <p>Playlist cá nhân</p>
            </div>
        `;
     
        playlistCard.onclick = () => window.appFunctions.openPlaylistDetail(playlist.id);
        playlistGrid.appendChild(playlistCard);
    });
    console.log(`Displayed ${playlists.length} playlists with colors:`, playlists.map(p => ({name: p.name, color: p.color})));
}

async function uploadPlaylistCover(userId, playlistId, coverFile) {
    const BUCKET_NAME = 'cover';
   
    const fileExt = coverFile.name.split('.').pop();
    const filePath = `playlists/${playlistId}/cover.${fileExt}`;
    try {
        console.log('Starting playlist cover upload to path:', filePath);
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, coverFile, {
                cacheControl: '3600',
                upsert: true,
            });
        if (uploadError) {
            console.error('Upload error:', uploadError);
            return null;
        }
        const { data: publicUrlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);
        console.log('Public URL:', publicUrlData.publicUrl);
        return publicUrlData.publicUrl;
    } catch (error) {
        console.error('System error during upload:', error);
        return null;
    }
}

async function handleCreatePlaylistSubmit(event) {
    event.preventDefault();
   
    const form = event.target;
    const playlistNameElement = form.querySelector('#playlistName');
    const playlistColorElement = form.querySelector('#playlistColor');
    const playlistName = playlistNameElement ? playlistNameElement.value.trim() : null;
    const playlistColor = playlistColorElement ? playlistColorElement.value : '#1db954';
    const playlistCoverFile = form.querySelector('#playlistCoverFile')?.files[0];
   
    if (!playlistName) {
        alert('Tên danh sách phát không được để trống.');
        return;
    }
   
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user) {
        console.error('Lỗi: Người dùng chưa đăng nhập hoặc lỗi xác thực:', userError);
        alert('Vui lòng đăng nhập để tạo danh sách phát!');
        return;
    }
    const user = data.user;
    try {
        const insertData = {
            user_id: user.id,
            name: playlistName,
            color: playlistColor,
            icon: null,
            cover_url: null
        };
       
        console.log('Dữ liệu INSERT:', insertData);
        const { data: newPlaylist, error } = await supabase
            .from('playlists')
            .insert([insertData])
            .select()
            .single();
        if (error) throw error;
        console.log('✅ Tạo playlist thành công. Dữ liệu trả về:', newPlaylist);
        closeModal('createPlaylistModal');
       
        // Upload cover nếu có
        if (playlistCoverFile && newPlaylist) {
            const uploadedUrl = await uploadPlaylistCover(user.id, newPlaylist.id, playlistCoverFile);
    if (uploadedUrl) {
        const { error: updateError } = await supabase
                .from('playlists')
                .update({ cover_url: uploadedUrl })
                .eq('id', newPlaylist.id);
            if (updateError) {
                console.error('Update cover error:', updateError);  // ← THÊM: Log exact error (RLS or field)
                alert('Tải ảnh nền thành công nhưng không lưu vào DB. Kiểm tra quyền RLS.');  // ← THÊM: Alert user
            } else {
                console.log('Playlist cover uploaded & updated:', uploadedUrl);
            }
        } else {
            console.warn('Cover upload failed - skipping');
        }
        }
       
        window.cachedPlaylists = null;
        await window.appFunctions.loadUserPlaylists(true);
        
        // ← FIX: Pass window.appFunctions.addTrackToPlaylist (không window.addTrackToPlaylist)
        const pendingTrackId = localStorage.getItem('pendingTrackId');
        if (pendingTrackId && newPlaylist) {
            const playlistId = newPlaylist.id;
            await window.appFunctions.addTrackToPlaylist(pendingTrackId, playlistId);  // ← FIX: appFunctions
            localStorage.removeItem('pendingTrackId');
            console.log('Auto-added pending track to new playlist');
        }
    } catch (error) {
        console.error('❌ LỖI HỆ THỐNG KHI TẠO PLAYLIST:', error);
        console.error('Exact error:', error.message);  // Log full để debug
        alert('Đã xảy ra lỗi không xác định: ' + error.message);
    }
}



const createPlaylistForm = document.getElementById('createPlaylistForm');
if (createPlaylistForm) {
    createPlaylistForm.addEventListener('submit', handleCreatePlaylistSubmit);
}

function toggleShuffle() {
    isShuffling = !isShuffling;
    const shuffleBtn = document.getElementById('shuffleBtn');
    if(shuffleBtn) {
        shuffleBtn.classList.toggle('active', isShuffling);
    }

    updateShuffleButtonUI();
    console.log('Shuffle mode:', isShuffling ? 'ON' : 'OFF');
    
    if (isShuffling && currentPlaylist.length > 1) {
        generateShuffleOrder();
    }
}

function updateShuffleButtonUI() {
    const shuffleBtn = document.getElementById('shuffleBtn');
    if (shuffleBtn) {
        shuffleBtn.setAttribute('data-state', isShuffling ? 'on' : 'off');
        shuffleBtn.style.color = isShuffling ? 'var(--primary-color)' : 'inherit';
    }
}

function generateShuffleOrder() {
    const array = Array.from({ length: currentPlaylist.length }, (_, i) => i);
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    shuffleOrder = array;
}

function toggleRepeat() {
    if (repeatMode === 'off') {
        repeatMode = 'all';
    } else if (repeatMode === 'all') {
        repeatMode = 'one';
    } else {
        repeatMode = 'off';
    }

    const repeatBtn = document.getElementById('repeatBtn');
    if (repeatBtn) {
        repeatBtn.classList.toggle('active', repeatMode !== 'off');  
    }
    updateRepeatButtonUI();
    updateRepeatButtonUI();
    console.log('Repeat mode:', repeatMode);
}

function updateRepeatButtonUI() {
    const repeatBtn = document.getElementById('repeatBtn');
    if (repeatBtn) {
        repeatBtn.setAttribute('data-mode', repeatMode);
        repeatBtn.style.color = repeatMode !== 'off' ? 'var(--primary-color)' : 'inherit';
    }
}

window.deleteTrack = async function(trackId) {
    if (!confirm('Xóa bài hát này? Không thể khôi phục!')) return;

    try {
        // XÓA TẤT CẢ playlist_tracks TRƯỚC
        const { error: unlinkError } = await supabase
            .from('playlist_tracks')
            .delete()
            .eq('track_id', trackId);

        if (unlinkError) throw unlinkError;

        // XÓA TRACK
        const { error: deleteError } = await supabase
            .from('tracks')
            .delete()
            .eq('id', trackId);

        if (deleteError) throw deleteError;

        alert('Đã xóa bài hát!');
        window.loadMyUploads(true); // refresh

    } catch (err) {
        console.error('Lỗi xóa:', err);
        alert('Lỗi: ' + err.message);
    }
};

window.loadPlaylistTracks = async function(playlistId, shouldPlay = false) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        console.error('User không đăng nhập, không tải tracks.');
        return [];
    }
    if (cachedPlaylistTracks && cachedPlaylistTracks[playlistId]) {
        return cachedPlaylistTracks[playlistId];
    }
    try {
        // BƯỚC 1: Fetch track_ids và added_at từ playlist_tracks (không nested)
        const { data: playlistItems, error: fetchItemsError } = await supabase
            .from('playlist_tracks')
            .select('track_id, added_at')
            .eq('playlist_id', playlistId)
            .order('added_at', { ascending: true });

        if (fetchItemsError) {
            console.error('Lỗi fetch playlist_items:', fetchItemsError);
            throw fetchItemsError;
        }

        if (playlistItems.length === 0) {
            console.log(`Playlist ${playlistId} trống - no items.`);
            const emptyTracks = [];
            if (!cachedPlaylistTracks) cachedPlaylistTracks = {};
            cachedPlaylistTracks[playlistId] = emptyTracks;
            window.currentPlaylistSource = 'Playlist ID ' + playlistId;
            return emptyTracks;
        }

        // BƯỚC 2: Extract track_ids array
        const trackIds = playlistItems.map(item => item.track_id);

        // BƯỚC 3: Fetch tracks details bằng IN clause (an toàn, không ambiguous)
        const { data: tracks, error: fetchTracksError } = await supabase
            .from('tracks')
            .select('id, title, artist, file_url, cover_url, user_id')
            .in('id', trackIds);

        if (fetchTracksError) {
            console.error('Lỗi fetch tracks by IDs:', fetchTracksError);
            throw fetchTracksError;
        }

        // BƯỚC 4: Merge added_at và sort theo order gốc (preserve added_at order)
        const tracksWithAddedAt = tracks.map(track => {
            const matchingItem = playlistItems.find(item => item.track_id === track.id);
            return {
                ...track,
                added_at: matchingItem ? matchingItem.added_at : null
            };
        }).sort((a, b) => {
            // Sort theo added_at (nếu có), fallback index gốc
            const timeA = new Date(a.added_at || 0).getTime();
            const timeB = new Date(b.added_at || 0).getTime();
            return timeA - timeB;
        });

        if (!cachedPlaylistTracks) cachedPlaylistTracks = {};
        cachedPlaylistTracks[playlistId] = tracksWithAddedAt;
        window.currentPlaylistSource = 'Playlist ID ' + playlistId;
        console.log(`Tải ${tracksWithAddedAt.length} tracks từ playlist ${playlistId}:`, tracksWithAddedAt.map(t => t.title));

        if (shouldPlay && tracksWithAddedAt.length > 0) {
            window.playTrack(tracksWithAddedAt[0], tracksWithAddedAt, 0);
        }

        return tracksWithAddedAt;
    } catch (error) {
        // THÊM: Log details để debug nếu cần (remove sau khi fix)
        console.error('Lỗi tải tracks playlist:', error);
        if (error.details) console.log('Relationship details:', error.details);  // ← MỚI: Log để xem exact names
        return [];
    }
};

window.appFunctions = {
    loadAndOpenProfileModal: loadAndOpenProfileModal,
    initializePlayerControls: initializePlayerControls,
    navigateTo: navigateTo,
    initProfileModal: initProfileModal,
    handleProfileSubmit: handleProfileSubmit,
    handleLogout: window.handleLogout,
    togglePlayPause: togglePlayPause,
    playTrack: window.playTrack,
    loadUserPlaylists: loadUserPlaylists,
    loadHistoryTracks: loadHistoryTracks,
    playNextTrack: window.playNextTrack,
    playPreviousTrack: window.playPreviousTrack,
    searchTracks: window.searchTracks,
    loadMyUploads: window.loadMyUploads,
    loadPlaylistTracks: window.loadPlaylistTracks,
    openPlaylistDetail: openPlaylistDetail,
    togglePlaylistDropdown: window.appFunctions.togglePlaylistDropdown, // Now defined
    deleteTrack: window.deleteTrack,
    addTrackToPlaylist: window.appFunctions.addTrackToPlaylist,
    createNewPlaylist: window.appFunctions.createNewPlaylist,
};
window.appFunctions.closeModal = closeModal;

window.displayTracks = function(tracks, container) {
    if (!container) return;
    container.innerHTML = '';
  
    const containerId = container.id;
    tracks.forEach((track, index) => {
        const trackElement = document.createElement('div');
        trackElement.className = 'track-item playable-track'; // Class cho CSS
        trackElement.trackData = track;
      
        // Click để play track (với stop nếu click action)
        trackElement.addEventListener('click', function(e) {
            if (e.target.closest('.btn-action')) return; // Stop nếu click action
            if (trackElement.trackData && window.appFunctions.playTrack) {
                window.currentPlaylist = tracks;
                window.currentTrackIndex = index;
                window.appFunctions.playTrack(trackElement.trackData, tracks, index);
            }
            e.preventDefault();
        });
      
        // Debug data
        const title = (track.title || '').trim() || 'Bài hát không tên';
        const artist = (track.artist || '').trim() || 'Nghệ sĩ không rõ';
        const titleInnerHTML = title.length > 15 ? `${title} ${title}` : title;
        const artistInnerHTML = artist.length > 15 ? `${artist} ${artist}` : artist; // Marquee nếu dài
      
        console.log(`Display track ${index} (${containerId}):`, { id: track.id, title: track.title, artist: track.artist });
      
        trackElement.innerHTML = `
            <div class="track-index">${index + 1}.</div>
            <img src="${track.cover_url || '/assets/default-cover.webp'}" alt="${title} by ${artist}" class="track-cover" />
            <div class="track-info">
                <div class="track-details">
                    <strong class="track-name marquee-container">
                        <span class="track-title-inner">${titleInnerHTML}</span>
                    </strong>
                    <small class="track-artist marquee-container">
                        <span class="track-artist-text">${artistInnerHTML}</span>
                    </small>
                </div>
            </div>
          
            <div class="track-actions">
                <div class="playlist-add-container">
                    <button
                        class="btn-action btn-add-playlist"
                        data-track-id="${track.id}"
                        title="Thêm vào playlist">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                    <div class="playlist-dropdown" data-track-id="${track.id}">
                    </div>
                </div>
                ${containerId === 'myUploadsList' ? `
                    <button class="btn-action btn-delete-track"
                            onclick="event.stopPropagation(); window.appFunctions.deleteTrack('${track.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                ` : ''}
            </div>
        `;
      
        // Marquee logic
        const titleContainer = trackElement.querySelector('.track-name.marquee-container');
        if (titleContainer) {
            const titleText = titleContainer.querySelector('.track-title-inner');
            if (titleText && titleText.scrollWidth > titleContainer.clientWidth) {
                titleText.classList.add('marquee');
            }
        }
      
        const artistContainer = trackElement.querySelector('.track-artist.marquee-container');
        if (artistContainer) {
            const artistText = artistContainer.querySelector('.track-artist-text');
            if (artistText && artistText.scrollWidth > artistContainer.clientWidth) {
                artistText.classList.add('marquee');
            }
        }
      
        container.appendChild(trackElement);
    });
  
    // Event Delegation (FIX: stopImmediate to prevent double fire)
    if (!container.dataset.delegationAttached) {
        container.addEventListener('click', function(e) {
            const btn = e.target.closest('.btn-add-playlist');
            if (btn) {
                e.stopPropagation();
                e.stopImmediatePropagation(); // FIX: Stop all events to prevent double toggle
                const trackId = btn.dataset.trackId;
                if (trackId) {
                    // Debounce
                    if (!window.dropdownDebounce) window.dropdownDebounce = {};
                    const key = `toggle_${trackId}`;
                    if (window.dropdownDebounce[key]) return;
                    window.dropdownDebounce[key] = true;
                    setTimeout(() => { delete window.dropdownDebounce[key]; }, 200);
                    
                    console.log('Toggle dropdown cho track (delegated):', trackId);
                    window.appFunctions.togglePlaylistDropdown(btn, trackId);
                }
            }
        });
        container.dataset.delegationAttached = 'true';
        console.log(`Event delegation attached for container ${containerId}`);
    }
  
    console.log(`Displayed ${tracks.length} tracks in ${containerId} - Check console for data`);
};

async function searchTracks(query) {
    const searchList = document.getElementById('searchList');
    if (!searchList) return;
    
    if (!query || query.length < 3) {
        searchList.innerHTML = '<p class="empty-message">Nhập từ khóa để bắt đầu tìm kiếm.</p>';
        return;
    }
    
    let dbQuery = supabase
        .from('tracks')
        .select(`
            id, 
            title, 
            artist, 
            file_url,
            cover_url,
            users!user_id (username)
        `); 

    dbQuery = dbQuery.or(`title.ilike.%${query}%,artist.ilike.%${query}%`);
    
    const { data: tracks, error } = await dbQuery.limit(10);

    if (error) {
        console.error('Lỗi tìm kiếm:', error);
        searchList.innerHTML = `<p class="error-message">Lỗi khi tìm kiếm: ${error.message}</p>`;
        return;
    }
    
    window.displayTracks(tracks, searchList); 
}

async function initProfileModal() {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
        console.error('Auth error:', authError);
        alert('Lỗi auth: ' + authError.message);
        return;
    }
    if (!user) {
        console.log('No user logged in');
        return;
    }

    console.log('Fetching profile for user ID:', user.id, 'Type:', typeof user.id);

    let { data: profile, error: selectError } = await supabase
        .from('users')
        .select('username, birthday, avatar_url')
        .eq('id', user.id)
        .single();

    if (selectError) {
        console.error('Select error:', selectError);
        alert('Lỗi select profile: ' + selectError.message + ' (Check RLS for SELECT policy)');
        if (selectError.code === 'PGRST116') {
            console.log('No profile - inserting default');
            const defaultUsername = user.email ? user.email.split('@')[0] : 'New User';

            const { data: newProfile, error: insertError } = await supabase
                .from('users')
                .insert([{ 
                    id: user.id, 
                    email: user.email || 'noemail@example.com',
                    username: defaultUsername,
                    birthday: null,
                    avatar_url: null
                }])
                .select('username, birthday, avatar_url')
                .single();

            if (insertError) {
                console.error('Insert error:', insertError);
                alert('Lỗi insert profile: ' + insertError.message + ' (Check RLS for INSERT policy)');
                return;
            }
            profile = newProfile;
        } else {
            return;
        }
    }

    console.log('Profile data:', profile);

    document.getElementById('editEmail').value = user.email || 'Chưa có email';

    const DEFAULT_AVATAR = '/assets/default-avatar.png';
    let finalAvatarUrl = profile.avatar_url ? getPublicAvatarUrl(profile.avatar_url) : DEFAULT_AVATAR;
    let usernameValue = profile.username || (user.email ? user.email.split('@')[0] : 'User Name');
    let birthdayValue = profile.birthday || '';

    document.getElementById('editUsername').value = usernameValue;
    document.getElementById('editBirthday').value = birthdayValue;

    const currentAvatarPreview = document.getElementById('currentAvatarPreview');
    if (currentAvatarPreview) currentAvatarPreview.src = finalAvatarUrl;

    window.cachedProfile = profile;
    updateProfileDisplay(user);
}

async function createDefaultPlaylistsIfNeeded(userId) {
    const defaultPlaylists = [
        { name: 'My Uploads', color: '#1db954' },
        { name: 'Recommendations', color: '#ff6b6b' }
    ];

    for (const pl of defaultPlaylists) {
        try {
            const { data: existing, error } = await supabase
                .from('playlists')
                .select('id')
                .eq('user_id', userId)
                .eq('name', pl.name)
                .single();
            if (!existing || (error && error.code === 'PGRST116')) {
                const { error: insertError } = await supabase
                    .from('playlists')
                    .insert([{ user_id: userId, name: pl.name, color: pl.color, icon: null }]);

                if (insertError) {
                    console.error(`Lỗi insert ${pl.name}:`, insertError);
                } else {
                    console.log(`Tạo playlist mặc định: ${pl.name}`);
                }
            } else if (existing) {
                console.log(`${pl.name} đã tồn tại.`);
            }
        } catch (error) {
            console.error(`Lỗi tạo ${pl.name}:`, error);
        }
    }
    cachedPlaylists = null;
    await loadUserPlaylists(true);
}

async function handleProfileSubmit(event) {
    event.preventDefault();
    console.log('Form submit triggered');

    const saveBtn = document.getElementById('saveProfileBtn');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newUsername = document.getElementById('editUsername').value.trim();
    const newBirthday = document.getElementById('editBirthday').value || null;
    const avatarFile = document.getElementById('avatarFile').files[0];

    if (!newUsername) {
        alert('Tên người dùng bắt buộc!');
        return;
    }
    if (newBirthday && isNaN(Date.parse(newBirthday))) {
        alert('Ngày sinh format sai!');
        return;
    }
    const currentProfile = await loadProfile(user.id);
    let finalAvatarUrl = currentProfile?.avatar_url || null;

    saveBtn.textContent = 'Đang lưu...';
    saveBtn.disabled = true;

    if (avatarFile) {
        const uploadedUrl = await uploadAvatar(user.id, avatarFile);
        if (!uploadedUrl) {
            alert('Lỗi upload avatar - check console');
            saveBtn.textContent = 'Lưu Thay Đổi';
            saveBtn.disabled = false;
            return;
        }
        finalAvatarUrl = uploadedUrl;
    }

    const updates = {
        email: user.email || 'noemail@example.com',
        username: newUsername,
        birthday: newBirthday,
        avatar_url: finalAvatarUrl || null
    };

    console.log('Preparing save with:', updates);

    const { count, error: countError } = await supabase
        .from('users')
        .select('count', { count: 'exact' })
        .eq('id', user.id);

    if (countError) {
        console.error('Count error:', countError);
        alert('Lỗi check profile: ' + countError.message + ' (Check RLS for SELECT)');
        saveBtn.textContent = 'Lưu Thay Đổi';
        saveBtn.disabled = false;
        return;
    }

    let data, error;
    if (count > 0) {
        console.log('Row exists - updating');
        ({ data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', user.id)
            .select());
    } else {
        console.log('No row - inserting');
        ({ data, error } = await supabase
            .from('users')
            .insert([{ id: user.id, ...updates }])
            .select());
    }

    if (error) {
        console.error('Save error:', error);
        alert('Lỗi save: ' + error.message + ' (Check RLS for UPDATE/INSERT)');
        saveBtn.textContent = 'Lưu Thay Đổi';
        saveBtn.disabled = false;
        return;
    }

    if (data.length > 0) {
        console.log('Save success, returned data:', data);
        alert('Lưu thành công!');
    } else {
        console.log('Save no row affected');
        alert('Không có thay đổi (RLS may block or values same)');
    }

    window.cachedProfile = null;
    updateProfileDisplay(user, true);
    saveBtn.textContent = 'Lưu Thay Đổi';
    saveBtn.disabled = false;
    
    closeModal('profileModal');
}

async function loadAndOpenProfileModal() {
    const modal = document.getElementById('profileModal');
    const container = document.getElementById('modalContentContainer'); 
    
    window.cachedProfile = null; 

    if (!container || !modal) {
        console.error('Không tìm thấy Modal hoặc Container.');
        return;
    }

    const loadingState = '<div style="padding: 20px; text-align: center;">Đang tải thông tin cá nhân...</div>';
    container.innerHTML = loadingState;
    modal.style.display = 'flex'; 

    if (container.innerHTML === loadingState) {
        try {
            const response = await fetch('/profile.html');
            if (!response.ok) throw new Error('Không thể tải profile.html');
            
            container.innerHTML = await response.text();
            
            const profileForm = document.getElementById('profileEditForm');
            if (profileForm && typeof handleProfileSubmit === 'function') { 
                 profileForm.removeEventListener('submit', handleProfileSubmit); 
                profileForm.addEventListener('submit', handleProfileSubmit); 
                console.log('Submit listener attached successfully to profileEditForm'); 
            } else {
                 console.error('Lỗi: Không tìm thấy form ID="profileEditForm" hoặc hàm handleProfileSubmit.');
            }
            
            const avatarFile = document.getElementById('avatarFile');
            if (avatarFile) {
                avatarFile.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const previewUrl = URL.createObjectURL(file);
                        document.getElementById('currentAvatarPreview').src = previewUrl; 
                        console.log('Avatar local preview set');
                    }
                });
            }
            
        } catch (error) {
            console.error('Lỗi tải Profile Modal HTML:', error);
            container.innerHTML = '<p style="padding: 20px;">Lỗi tải giao diện. Vui lòng thử lại.</p>';
            return;
        }
    }

    if (typeof window.initProfileModal === 'function') {
         await window.initProfileModal();
    } else {
        console.warn("Hàm initProfileModal chưa được định nghĩa.");
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
         container.innerHTML = '<p style="padding: 20px;">Vui lòng đăng nhập lại để xem thông tin cá nhân.</p>';
    }
}

async function loadHistoryTracks(forceRefresh = false) {
    const user = (await supabase.auth.getUser()).data.user;
    const historyTrackList = document.getElementById('historyTrackList');
    if (!user || !historyTrackList) return;
    
    if (cachedHistoryTracks && !forceRefresh) {
        const tracks = cachedHistoryTracks.map(item => ({...item.tracks, id: item.track_id})); 
        if (window.displayTracks) {
            window.displayTracks(tracks, historyTrackList);
        }
        return; 
    }

    historyTrackList.innerHTML = '<p>Đang tải lịch sử...</p>';

    try {
        const { data: historyItems, error } = await supabase
            .from('history')
            .select(`
                track_id, 
                played_at, 
                tracks (id, title, artist, file_url, cover_url) 
            `)
            .eq('user_id', user.id)
            .order('played_at', { ascending: false }) 
            .limit(20); 

        if (error) throw error;
        
        cachedHistoryTracks = historyItems;

        historyTrackList.innerHTML = ''; 

        if (historyItems.length === 0) {
            historyTrackList.innerHTML = '<p class="empty-message">Bạn chưa phát bài hát nào gần đây.</p>';
        } else {
            const trackList = historyItems.map(item => item.tracks); 
            if (window.displayTracks) {
                window.displayTracks(trackList, historyTrackList);
            }
        }
    } catch (error) {
        console.error('❌ Lỗi tải Lịch sử:', error);
        historyTrackList.innerHTML = '<p class="error-message">Lỗi khi tải lịch sử phát nhạc.</p>';
    }
}

window.openCreatePlaylistModal = function() {
    
    console.log('--- Bắt đầu mở modal tạo playlist ---'); 
    
    const modal = document.getElementById('createPlaylistModal');
    if (modal) {
        modal.style.display = 'flex';
        const form = document.getElementById('createPlaylistForm');
        if (form) {
            const handler = window.handleCreatePlaylistSubmit || handleCreatePlaylistSubmit;
            
            if(typeof handler !== 'function') {
                 console.error('Lỗi: handleCreatePlaylistSubmit chưa được định nghĩa hoặc chưa được gắn vào window.');
                 return;
            }

            form.removeEventListener('submit', handler); 
            form.addEventListener('submit', handler); 
            console.log('Form submit listener attached.');
        } else {
             console.error('Lỗi: Không tìm thấy form ID="createPlaylistForm".');
        }
    } else {
        console.error('Lỗi: Không tìm thấy modal ID="createPlaylistModal".');
    }
};

function renderTrackListItem(track) {
    const item = document.createElement('div');
    item.className = 'track-item';
    item.innerHTML = `<div class="track-info">${track.title} - ${track.artist}</div>`;
    return item;
}

window.renderTrackItem = function(track, index, containerId) {
    const item = document.createElement('div');
    item.className = 'track-item playable-track';
    item.dataset.trackId = track.id;

    const safeTitle = (track.title || 'Unknown Title').trim();
    const safeArtist = (track.artist || 'Unknown Artist').trim();
    const safeCover = track.cover_url || '/assets/default-cover.webp';

    // HTML cho track item
    item.innerHTML = `
        <div class="track-info">
            <span class="track-index">${index + 1}</span>
            <img src="${safeCover}" alt="${safeTitle}" class="track-cover" 
                 onerror="this.src='/assets/default-cover.webp'">
            <div class="track-details">
                <div class="track-name marquee-container">
                    <span class="track-title-inner">${safeTitle}</span>
                </div>
                <div class="track-artist">${safeArtist}</div>
            </div>
        </div>
        <div class="track-actions">
            <div class="playlist-add-container">
                <button class="btn-action" 
                        onclick="appFunctions.togglePlaylistDropdown(this, '${track.id}')"
                        title="Thêm vào playlist">
                    <i class="fas fa-plus"></i>
                </button>
                <div class="playlist-dropdown"></div>
            </div>

            <!-- NÚT XÓA - CHỈ HIỆN Ở UPLOADS -->
            ${containerId === 'myUploadsList' ? `
            <button class="btn-action text-danger" 
                    onclick="event.stopPropagation(); deleteTrack('${track.id}')" 
                    title="Xóa bài hát">
                <i class="fas fa-trash"></i>
            </button>` : ''}
        </div>
    `;

    // Click để phát nhạc (tránh click vào nút)
    item.addEventListener('click', (e) => {
        if (e.target.closest('.btn-action')) return;
        const playlist = window.currentPlaylists?.[containerId] || [];
        window.playTrack(track, playlist, index);
    });

    // Marquee effect
    setTimeout(() => {
        const titleEl = item.querySelector('.track-title-inner');
        const containerEl = item.querySelector('.marquee-container');
        if (titleEl && containerEl && titleEl.scrollWidth > containerEl.clientWidth) {
            titleEl.classList.add('marquee');
        }
    }, 100);

    return item;
};

window.renderTrackList = function(tracks, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    window.currentPlaylists = window.currentPlaylists || {};
    window.currentPlaylists[containerId] = tracks;

    if (tracks.length === 0) {
        container.innerHTML = '<p class="empty-message">Không có bài hát</p>';
        return;
    }

    tracks.forEach((track, index) => {
        const item = window.renderTrackItem(track, index, containerId);
        container.appendChild(item);
    });

    console.log(`Displayed ${tracks.length} tracks in ${containerId}`);
};

window.loadMyUploads = async function(forceRefresh = false) {
    const container = document.getElementById('myUploadsList');
    if (!container) return;

    if (forceRefresh || !cachedMyUploads || cachedMyUploads.length === 0) {
        cachedMyUploads = null;  
        console.log('Cache invalidated for uploads (forceRefresh:', forceRefresh, ')');
    }

    if (cachedMyUploads && !forceRefresh) {
        window.displayTracks(cachedMyUploads, container);
        return;
    }

    container.innerHTML = '<p>Đang tải danh sách bài hát...</p>';
    
    const { data: { user } } = await supabase.auth.getUser(); 
    if (!user) {
        container.innerHTML = '<p class="error-message">Vui lòng đăng nhập để xem danh sách tải lên.</p>';
        return;
    }
    
    try {
        const { data: tracks, error } = await supabase
            .from('tracks')
            .select('*, users!user_id (username)')
            .eq('user_id', user.id) 
            .order('uploaded_at', { ascending: false });

        if (error) throw error;

        cachedMyUploads = tracks;

        if (tracks.length === 0) {
            container.innerHTML = '<p class="empty-message">Bạn chưa tải lên bài hát nào.</p>';
            return;
        }

        window.displayTracks(tracks, container);
    } catch (error) {
        console.error('Lỗi tải uploads:', error);
        container.innerHTML = `<p class="error-message">Lỗi khi tải: ${error.message}</p>`;
    }
}


window.loadHomePage = async function() {
    const mainContentArea = document.getElementById('mainContentArea'); 
    
    if (!mainContentArea) return; 
    
    try {
        const response = await fetch('/home-content.html');
        if (!response.ok) throw new Error('Không thể tải home-content.html');
        
        const htmlContent = await response.text();
        mainContentArea.innerHTML = htmlContent;

        return new Promise(resolve => {
            setTimeout(() => {
                loadUserPlaylists(); 

                const createPlaylistBtn = document.getElementById('createPlaylistBtn');
                if (createPlaylistBtn) {
                    createPlaylistBtn.addEventListener('click', window.openCreatePlaylistModal);
                }
                
                resolve(); 
            }, 50); 
        });
        
    } catch (error) {
        console.error("Lỗi tải giao diện Trang Chủ:", error);
        alert('Lỗi tải giao diện trang chủ!');
        return Promise.resolve(); 
    }
}

async function loadRecommendations() {
    console.log('--- Bắt đầu tải danh sách gợi ý ---');
    const recommendList = document.getElementById('recommendList');  
    if (!recommendList) {
        console.error('Không tìm thấy #recommendList');
        return;
    }
    
    try {
        const { data: recentTracks, error } = await supabase
            .rpc('get_unique_recommendations', { limit_count: 20 });

        if (error) {
            console.error('RPC Error details:', error); 
            throw error;
        }
        
        if (recentTracks && recentTracks.length > 0) {
            // FIX: Dedup by title+artist (case-insensitive)
            const uniqueRecs = recentTracks.filter((track, index, self) =>
                index === self.findIndex(t => 
                    t.title.toLowerCase().trim() === track.title.toLowerCase().trim() &&
                    t.artist.toLowerCase().trim() === track.artist.toLowerCase().trim()
                )
            );
            console.log(`Original recs: ${recentTracks.length}, Unique: ${uniqueRecs.length}`); // Debug
            recommendList.innerHTML = '<h3>Gợi ý (' + uniqueRecs.length + ' bài unique)</h3>';  
            window.displayTracks(uniqueRecs, recommendList);
            cachedRecommendedTracks = uniqueRecs; // Cache unique version
            window.currentPlaylistSource = 'Gợi ý cho bạn';
            console.log(`Loaded ${uniqueRecs.length} unique recommendations`);
        } else {
            recommendList.innerHTML = '<p class="empty-message">Hiện chưa có bài hát mới nào.</p>';
        }

    } catch (error) {
        console.error('Lỗi tải gợi ý:', error);
        recommendList.innerHTML = `<p class="error-message">Không thể tải gợi ý: ${error.message}</p>`;
    }
}

window.handleLogout = async function() {
    try {
        cachedPlaylists = null;
        cachedHistoryTracks = null;
        cachedRecommendedTracks = null;
        cachedProfile = null;
        
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        window.location.href = '/index.html'; 
    } catch (error) {
        console.error('Lỗi khi đăng xuất:', error);
        alert('Đăng xuất thất bại.');
    }
};

async function resumeRecentTrack(user) {
    if (!user) return;

    if (window.recentTrackLoaded) {
        console.log('Recent track already loaded, skipping');
        return;
    }
    window.recentTrackLoaded = true;

    try {
        const { data: recent, error } = await supabase
            .from('history')
            .select(`
                track_id,
                tracks (
                    id, title, artist, file_url, cover_url
                )
            `)
            .eq('user_id', user.id)
            .order('played_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !recent || !recent.tracks) {
            console.log('No recent track to resume (empty history)');
            return;
        }

        const track = { ...recent.tracks, id: recent.track_id };

        // Await load recs
        let recs = cachedRecommendedTracks || [];
        if (recs.length === 0) {
            const { data, error: recError } = await supabase
                .rpc('get_unique_recommendations', { limit_count: 20 });
            if (!recError) {
                recs = data || [];
                cachedRecommendedTracks = recs;  // Cache ngay
            } else {
                console.error('Failed to load recs for resume:', recError);
                recs = [];  // Fallback empty
            }
        }

        currentPlaylist = recs;
        window.currentPlaylistSource = 'Lịch sử gần nhất';
        console.log('Loaded recs as temp playlist for next random');

        // FIX: Set index AFTER recs is fully assigned, with guard
        if (recs && recs.length > 0) {
            const recentIndex = recs.findIndex(t => t.id === track.id);
            currentTrackIndex = recentIndex !== -1 ? recentIndex : 0;
            console.log(`Resume: Recent "${track.title}" at index ${currentTrackIndex} in recs (${recs.length} total)`);
        } else {
            currentTrackIndex = 0;
            console.warn('No recs available for resume - index fallback to 0');
        }

        // Preload audio (giữ global listeners)
        let audioUrl = track.file_url;
        if (audioUrl.includes('supabase.co')) {
            const ts = Date.now();
            const rand = Math.random().toString(36).substring(7);
            audioUrl += (audioUrl.includes('?') ? '&' : '?') + `t=${ts}&r=${rand}`;
        }
        currentAudio = new Audio(audioUrl);
        currentAudio.track = track;
        currentAudio.volume = volume;
        currentAudio.preload = 'auto';
        currentAudio.crossOrigin = 'anonymous';

        if (!window.preloadListenersAttached) {
            window.preloadListenersAttached = true;
            window.preloadOnLoadedMetadata = function() {
                console.log('Preloaded metadata for resume:', track.title);
                updateProgressBar();
            };
            window.preloadOnTimeUpdate = function() {
                updateProgressBar();
            };
            window.preloadOnEnded = function() {
                isPlaying = false;
                const playPauseBtn = document.getElementById('playPauseBtn');
                const playIcon = playPauseBtn ? playPauseBtn.querySelector('i') : null;
                if (playIcon) playIcon.className = 'fas fa-play';
                if (currentPlaylist.length > 0) setTimeout(window.playNextTrack, 1000);
            };
            window.preloadOnError = function(e) {
                console.error('Preload error for resume:', e);
                currentAudio = null;
            };

            currentAudio.addEventListener('loadedmetadata', window.preloadOnLoadedMetadata);
            currentAudio.addEventListener('timeupdate', window.preloadOnTimeUpdate);
            currentAudio.addEventListener('ended', window.preloadOnEnded);
            currentAudio.addEventListener('error', window.preloadOnError);
        }

        isPlaying = false;

        
        function updateUI() {
            if (typeof window.updatePlayerBar === 'function') {
                window.updatePlayerBar(track);
                console.log('Loaded recent track to UI + preloaded audio (no auto-play):', track.title);
            } else {
                console.warn('updatePlayerBar not ready, retrying...');
                setTimeout(updateUI, 100);  
            }
        }
        updateUI();
    } catch (error) {
        console.error(' Error loading recent track:', error);
    }
}

window.appFunctions.togglePlaylistDropdown = async function(button, trackId) {
    console.log('Toggle dropdown cho track:', trackId);
    const container = button.closest('.playlist-add-container');
    if (!container) return console.error('Không tìm thấy .playlist-add-container');
    const dropdown = container.querySelector('.playlist-dropdown');
    if (!dropdown) return console.error('Không tìm thấy .playlist-dropdown');

    // Đóng tất cả dropdown khác
    document.querySelectorAll('.playlist-dropdown.active').forEach(d => {
        if (d !== dropdown) {
            d.classList.remove('active');
            document.body.classList.remove('dropdown-open');
            console.log('Closed other dropdown');
        }
    });

    const wasActive = dropdown.classList.contains('active');
    if (wasActive) {
        dropdown.classList.remove('active');
        document.body.classList.remove('dropdown-open');
        document.removeEventListener('click', window.outsideClickHandler);
        dropdown.removeEventListener('mouseleave', window.mouseLeaveHandler);
        console.log(`Dropdown state: on → off for ${trackId}`);
    } else {
        // VỊ TRÍ DƯỚI + BÊN PHẢI, FULL FLIP OFF-SCREEN
        const rect = button.getBoundingClientRect();
        const gap = 0;  // ← FIX: Sát button, tránh lệch
        const dropdownWidth = 220;
        let leftPos = rect.right + window.scrollX + gap;  // Bay phải
        let align = 'right';

        // FULL FLIP: Nếu quá phải (margin safe 20px)
        const viewportRight = window.innerWidth + window.scrollX - 20;
        if (leftPos + dropdownWidth > viewportRight) {
            leftPos = rect.left + window.scrollX - gap - dropdownWidth;  // ← FIX: Căn phải viewport, bay trái từ button
            align = 'left-flip';
            console.log('Off-screen detected: Flipped to left align (left=' + leftPos + ')');
        }

        // SET STYLE EARLY
        dropdown.style.top = `${rect.bottom + window.scrollY + gap}px`;
        dropdown.style.left = `${leftPos}px`;
        dropdown.style.width = `${dropdownWidth}px`;
        dropdown.style.right = 'auto';
        dropdown.style.height = 'auto';  // Reset height early

        dropdown.classList.add('active');
        document.body.classList.add('dropdown-open');

        // DEBUG LOGS
        console.log(`Dropdown after active: display=${getComputedStyle(dropdown).display}, opacity=${getComputedStyle(dropdown).opacity}, position=${getComputedStyle(dropdown).position}, bg=${getComputedStyle(dropdown).backgroundColor}, z=${getComputedStyle(dropdown).zIndex}`);
        console.log(`Rect after: top=${dropdown.getBoundingClientRect().top}, left=${dropdown.getBoundingClientRect().left}, width=${dropdown.getBoundingClientRect().width}, height=${dropdown.offsetHeight}px, visible=${dropdown.offsetHeight > 0}, align=${align}`);

        // CLEAR & LOAD
        dropdown.innerHTML = '';
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                dropdown.innerHTML = '<div class="empty-message">Đăng nhập để thêm playlist</div>';
            } else {
                let playlists = window.cachedPlaylists || [];
                if (playlists.length === 0) {
                    const { data: fetched, error } = await supabase
                        .from('playlists')
                        .select('id, name, color')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false });
                    if (error) throw error;
                    playlists = fetched || [];
                    window.cachedPlaylists = playlists;
                    console.log(`Fetched & cached ${playlists.length} playlists`);
                } else {
                    console.log(`Using cached ${playlists.length} playlists`);
                }
                
                let html = '';
                if (playlists.length === 0) {
                    html = `<div class="playlist-option create-new" onclick="appFunctions.createNewPlaylist('${trackId}'); event.stopPropagation(); event.preventDefault(); closeDropdown('${trackId}');"> + Tạo playlist mới </div>`;
                } else {
                    playlists.forEach(pl => {
                        html += `<div class="playlist-option" style="border-left: 3px solid ${pl.color || '#1DB954'};" onclick="appFunctions.addTrackToPlaylist('${trackId}', '${pl.id}'); event.stopPropagation(); event.preventDefault(); closeDropdown('${trackId}');"> ${pl.name} </div>`;
                    });
                    html += `<div class="playlist-option create-new" onclick="appFunctions.createNewPlaylist('${trackId}'); event.stopPropagation(); event.preventDefault(); closeDropdown('${trackId}');"> + Tạo playlist mới </div>`;
                }
                dropdown.innerHTML = html;
                console.log(`HTML set: ${html.substring(0, 100)}...`);

                // ← FIX: FORCE REFLOW HEIGHT SAU HTML SET
                dropdown.style.height = 'auto';
                dropdown.offsetHeight;  // Trigger recalc
                console.log(`Reflow triggered: new height=${dropdown.offsetHeight}px`);
            }
            dropdown.dataset.loaded = 'true';
        } catch (err) {
            console.error('Lỗi load playlist dropdown:', err);
            dropdown.innerHTML = '<div class="error-message">Lỗi tải playlist</div>';
            // Reflow for error too
            dropdown.offsetHeight;
        }

        // MOUSE LEAVE & OUTSIDE CLICK
        window.mouseLeaveHandler = () => {
            setTimeout(() => {
                dropdown.classList.remove('active');
                document.body.classList.remove('dropdown-open');
                document.removeEventListener('click', window.outsideClickHandler);
                dropdown.removeEventListener('mouseleave', window.mouseLeaveHandler);
                console.log(`Closed on mouse leave for ${trackId}`);
            }, 200);
        };
        dropdown.addEventListener('mouseleave', window.mouseLeaveHandler);

        window.outsideClickHandler = (e) => {
            if (!dropdown.contains(e.target) && !button.contains(e.target)) {
                dropdown.classList.remove('active');
                document.body.classList.remove('dropdown-open');
                document.removeEventListener('click', window.outsideClickHandler);
                dropdown.removeEventListener('mouseleave', window.mouseLeaveHandler);
                console.log(`Closed on outside click for ${trackId}`);
            }
        };
        document.addEventListener('click', window.outsideClickHandler);

        console.log(`Dropdown state: off → on (under-right fixed, align=${align}) for ${trackId}`);
    }
};

window.closeDropdown = function(trackId) {
    const container = document.querySelector(`.playlist-add-container [data-track-id="${trackId}"]`).closest('.playlist-add-container');
    if (container) {
        const dropdown = container.querySelector('.playlist-dropdown');
        if (dropdown) {
            dropdown.classList.remove('active');
            document.body.classList.remove('dropdown-open');
            console.log(`Closed dropdown for ${trackId}`);
        }
    }
};

window.appFunctions.addTrackToPlaylist = async function(trackId, playlistId) {
    try {
        const { data: existing } = await supabase
            .from('playlist_tracks')
            .select('id')
            .eq('playlist_id', playlistId)
            .eq('track_id', trackId)
            .limit(1);

        if (existing?.length > 0) {
            alert('Bài hát đã có trong playlist!');
            return;
        }

        const { error } = await supabase
            .from('playlist_tracks')
            .insert({ playlist_id: playlistId, track_id: trackId });

        if (error) throw error;

        alert('Đã thêm vào playlist!');
        if (window.loadDetailPlaylist) {
            const detail = document.getElementById('playlistDetail');
            if (detail && detail.dataset.playlistId === playlistId) {
                window.loadDetailPlaylist(playlistId);
            }
        }
    } catch (err) {
        console.error('Lỗi thêm:', err);
        alert('Lỗi: ' + err.message);
    }
};

window.appFunctions.createNewPlaylist = function(trackId) {
    localStorage.setItem('pendingTrackId', trackId);
    const modal = document.getElementById('createPlaylistModal');
    if (modal) modal.style.display = 'flex';
};


document.addEventListener('DOMContentLoaded', () => {
    // ← FIX: PARSE OAUTH CALLBACK TOKEN TỪ URL HASH (SAU LOGIN GOOGLE/EMAIL IMPLICIT FLOW)
    const urlHash = window.location.hash.substring(1);  // #access_token=... → access_token=...
    if (urlHash) {
        const params = new URLSearchParams(urlHash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
            supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
            }).then(({ data: { session }, error }) => {
                if (error) {
                    console.error('Set session error:', error);
                } else {
                    console.log('Session set from callback:', session.user.email);
                    // Clear hash from URL
                    window.history.replaceState({}, document.title, window.location.pathname);
                    // Redirect to main app
                    window.location.href = '/player.html';
                }
            });
        }
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) {
            window.location.href = "/index.html";
        } else {
            updateProfileDisplay(user);
            
            if(!window.userSessionLoaded) {
                window.userSessionLoaded = true;
                setTimeout(() => {
                    resumeRecentTrack(user);
                },200);
            }

            window.loadHomePage().then(() => {
                window.switchTab('home'); 
            });
        }
    }).catch(error => console.error(' Auth check error:', error));

    supabase.auth.onAuthStateChange(async (event, session) => {
        const user = session?.user;
        
        if (event === 'SIGNED_IN') {
            updateProfileDisplay(user);
            cachedPlaylists = null;
            cachedHistoryTracks = null;
            cachedRecommendedTracks = null;
            loadUserPlaylists(true);
            
            if(!window.userSessionLoaded) {
                window.userSessionLoaded = true;
                resumeRecentTrack(user);
            }
            
            // ← FIX: Redirect chỉ nếu ở index.html (giữ nguyên)
            if (window.location.pathname.includes('index.html')) {
                window.location.href = '/player.html';
            }

            // FIX: Upsert users table sau SIGNED_IN (cho cả email & Google) – chỉ chạy nếu user tồn tại
            if (user) {
                // Check email confirmed (nếu là email provider) – tránh alert nhầm với Google
                if (user.app_metadata?.provider === 'email' && !user.email_confirmed_at) {
                    alert('Email chưa xác nhận! Vui lòng kiểm tra mail và click link xác nhận trước khi sử dụng app.');
                    // Không redirect nếu chưa confirm, quay về index
                    if (window.location.pathname.includes('player.html')) {
                        window.location.href = '/index.html';
                    }
                    return;  // Dừng upsert nếu chưa confirm
                }

                console.log('SIGNED_IN: Syncing users table for', user.email);

                // Lấy existing profile hoặc fallback từ metadata (await ok vì async scope)
                const { data: profile, error: selectError } = await supabase
                    .from('users')
                    .select('username, birthday, avatar_url')
                    .eq('id', user.id)
                    .single();

                if (selectError && selectError.code !== 'PGRST116') {  // Ignore "no row" error
                    console.error('Select profile error:', selectError);
                }

                // Map data: Ưu tiên existing > metadata > default
                const username = profile?.username || 
                                user.user_metadata?.username || 
                                user.user_metadata?.full_name ||  // Cho Google
                                user.email?.split('@')[0] || 'User Name';
                const birthday = profile?.birthday || user.user_metadata?.birthday || null;
                const avatarUrl = profile?.avatar_url || null;

                // Upsert (await ok vì async scope)
                const { error: upsertError } = await supabase
                    .from('users')
                    .upsert({
                        id: user.id,
                        email: user.email,
                        username: username,
                        birthday: birthday,
                        avatar_url: avatarUrl,
                        updated_at: new Date().toISOString()
                    });

                if (upsertError) {
                    console.error('Upsert users error in SIGNED_IN:', upsertError);  // Log để debug RLS/fields
                    // Không throw, vẫn tiếp tục app (profile sẽ fallback trong updateProfileDisplay)
                } else {
                    console.log('✅ Users table synced after SIGNED_IN');
                    window.cachedProfile = null;  // Invalidate cache để refresh profile
                }
            }
        } else if (event === 'SIGNED_OUT') {
            updateProfileDisplay(null);
            window.userSessionLoaded = false;
            if (typeof cachedPlaylists !== 'undefined') cachedPlaylists = null;
            if (typeof cachedHistoryTracks !== 'undefined') cachedHistoryTracks = null;
            if (typeof cachedRecommendedTracks !== 'undefined') cachedRecommendedTracks = null;
            if (typeof cachedProfile !== 'undefined') cachedProfile = null;
        
            if (typeof window.cachedPlaylistTracks !== 'undefined') window.cachedPlaylistTracks = null;
            if (typeof window.cachedRecommendationsPlaylistId !== 'undefined') window.cachedRecommendationsPlaylistId = null;
        
            // ← FIX: Clear localStorage session nếu cần (cho Supabase session persist)
            localStorage.removeItem('supabase.auth.token');
        
            // ← FIX: Redirect nếu không ở index
            if (window.location.pathname !== '/index.html') {
                window.location.href = "/index.html";
            }
        }
            
            if (event === 'SIGNED_OUT' && window.location.pathname !== '/index.html') {
                window.location.href = "/index.html";
            }
        });

        if (event === 'SIGNED_OUT' && window.location.pathname !== '/index.html') {
            window.location.href = "/index.html";
        }

    // ← FIX: Form listener – Sử dụng handleCreatePlaylistSubmit (không handleCreatePlaylist)
    const newPlaylistForm = document.getElementById('newPlaylistForm');
    if (newPlaylistForm && window.handleCreatePlaylistSubmit) {
        newPlaylistForm.addEventListener('submit', window.handleCreatePlaylistSubmit);
    }
});


window.initializePlayerControls = initializePlayerControls; 
window.togglePlayPause = togglePlayPause;
window.updateProfileDisplay = updateProfileDisplay;
window.initProfileModal = initProfileModal;
window.handleCreatePlaylistSubmit = handleCreatePlaylistSubmit;
window.searchTracks = searchTracks;
window.loadRecommendations = loadRecommendations;
window.displayTracks = displayTracks;
window.openPlaylistDetail = openPlaylistDetail;
window.currentPlaylist = currentPlaylist;
window.currentTrackIndex = currentTrackIndex;

function navigateTo(target) {
    if (target === 'home') {
        window.location.href = '/player.html';
    } 
}