import {
    setCurrentTrack,
    setPlayList,
    setPlayerError,
    setPlayerLoading,
    setPlayerReady,
    setPlayerSource,
    setPlaying,
    $volume,
    type PlayerSource,
    type TrackInfo,
} from '../../stores/player';

type LyricsLine = {
    time: number;
    content: string;
};

type LyricsStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

type MetingTrack = {
    name?: string;
    artist?: string;
    url?: string;
    pic?: string;
    lrc?: string;
};

type PlayerEngine = {
    audio: HTMLAudioElement;
    sourceApi: string;
    playlist: TrackInfo[];
    index: number;
};

export type LyricsFrame = {
    current: string;
    next: string;
};

export type PlayerBridgeOptions = {
    source: PlayerSource;
    onLyricFrame?: (payload: LyricsFrame) => void;
    onLyricsStatus?: (status: LyricsStatus) => void;
};

export type PlayerBridgeControls = {
    toggleMusic: () => void;
    playPrev: () => void;
    playNext: () => void;
    setSource: (source: PlayerSource) => Promise<void>;
    destroy: () => void;
};

const WAITING_TEXT = 'WAITING FOR SIGNAL...';
const NO_LYRICS_TEXT = 'NO LYRICS FOUND';
const LYRICS_ERROR_TEXT = 'LRC ERROR';

const playlistCache = new Map<string, Promise<TrackInfo[]>>();
const lyricsCache = new Map<string, Promise<LyricsLine[]>>();
let engine: PlayerEngine | null = null;

function getEngine(): PlayerEngine {
    if (engine) return engine;

    const audio = new Audio();
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';

    engine = {
        audio,
        sourceApi: '',
        playlist: [],
        index: 0,
    };

    return engine;
}

function normalizeTrack(track: MetingTrack): TrackInfo | null {
    if (!track?.url) return null;

    return {
        title: track.name?.trim() || 'Unknown Track',
        artist: track.artist?.trim() || 'UNKNOWN ARTIST',
        url: track.url,
        cover: track.pic,
        lrc: track.lrc,
    };
}

function fetchPlaylist(sourceApi: string): Promise<TrackInfo[]> {
    const cached = playlistCache.get(sourceApi);
    if (cached) return cached;

    const loader = (async () => {
        const response = await fetch(sourceApi);
        if (!response.ok) {
            throw new Error(`歌单接口请求失败: HTTP ${response.status}`);
        }

        const payload = await response.json();
        if (!Array.isArray(payload)) {
            throw new Error('歌单接口返回格式无效，期望数组。');
        }

        const tracks = payload
            .map((item) => normalizeTrack(item as MetingTrack))
            .filter((item): item is TrackInfo => item !== null);
        if (!tracks.length) {
            throw new Error('歌单为空或资源 URL 无效。');
        }

        return tracks;
    })();

    playlistCache.set(sourceApi, loader);
    return loader;
}

function parseLyrics(raw: string): LyricsLine[] {
    const lines = raw.split(/\r?\n/);
    const result: LyricsLine[] = [];

    for (const line of lines) {
        const timeReg = /\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
        const content = line.replace(timeReg, '').trim();
        if (!content) continue;

        let match: RegExpExecArray | null = null;
        while ((match = timeReg.exec(line)) !== null) {
            const min = Number.parseInt(match[1], 10);
            const sec = Number.parseInt(match[2], 10);
            const rawMs = match[3] ?? '0';
            const ms = Number.parseInt(rawMs.padEnd(3, '0').slice(0, 3), 10);
            const time = min * 60 + sec + ms / 1000;
            result.push({ time, content });
        }
    }

    return result.sort((a, b) => a.time - b.time);
}

function resolveLyrics(lrc: string): Promise<LyricsLine[]> {
    const key = lrc.trim();
    if (!key) return Promise.resolve([]);

    const cached = lyricsCache.get(key);
    if (cached) return cached;

    const loader = (async () => {
        if (!key.startsWith('http')) {
            return parseLyrics(key);
        }

        const response = await fetch(key);
        if (!response.ok) {
            throw new Error(`歌词接口请求失败: HTTP ${response.status}`);
        }
        return parseLyrics(await response.text());
    })();

    lyricsCache.set(key, loader);
    return loader;
}

function findLyricFrame(lines: LyricsLine[], currentTime: number): LyricsFrame {
    if (!lines.length) {
        return { current: WAITING_TEXT, next: '' };
    }

    let activeIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        if (currentTime >= lines[i].time) {
            activeIndex = i;
        } else {
            break;
        }
    }

    if (activeIndex < 0) {
        return {
            current: WAITING_TEXT,
            next: lines[0]?.content ?? '',
        };
    }

    return {
        current: lines[activeIndex].content,
        next: lines[activeIndex + 1]?.content ?? '',
    };
}

function normalizeIndex(nextIndex: number, length: number) {
    if (length === 0) return 0;
    return (nextIndex + length) % length;
}

/**
 * 根据当前播放状态切换播放源。
 * 如果切源前正在播放，则新源加载完成后继续播放；如果原本是暂停状态，则只更新曲目不自动播放。
 */
export async function initPlayerBridge({
    source,
    onLyricFrame,
    onLyricsStatus,
}: PlayerBridgeOptions): Promise<PlayerBridgeControls> {
    let lastLyricFrameKey = '';
    const emitLyricFrame = (frame: LyricsFrame, force = false) => {
        const key = `${frame.current}\n${frame.next}`;
        if (!force && key === lastLyricFrameKey) return;
        lastLyricFrameKey = key;
        onLyricFrame?.(frame);
    };

    setPlayerSource(source);
    setPlayerLoading();
    emitLyricFrame({ current: WAITING_TEXT, next: '' }, true);
    onLyricsStatus?.('loading');

    const player = getEngine();
    let disposed = false;
    let currentLyrics: LyricsLine[] = [];

    const syncTrackStore = () => {
        const current = player.playlist[player.index] ?? null;
        setCurrentTrack(current);
        setPlayList(player.playlist);
    };

    const syncLyricByTime = () => {
        if (disposed) return;
        emitLyricFrame(findLyricFrame(currentLyrics, player.audio.currentTime || 0));
    };

    const unbindVolume = $volume.listen((vol) => {
        if (disposed) return;
        if (player.audio.volume !== vol) {
            player.audio.volume = vol;
        }
    });

    player.audio.volume = $volume.get();

    const loadCurrentLyrics = async () => {
        if (disposed) return;
        const track = player.playlist[player.index];
        if (!track?.lrc) {
            currentLyrics = [];
            onLyricsStatus?.('empty');
            emitLyricFrame({ current: NO_LYRICS_TEXT, next: '' }, true);
            return;
        }

        onLyricsStatus?.('loading');
        emitLyricFrame({ current: WAITING_TEXT, next: '' }, true);

        try {
            currentLyrics = await resolveLyrics(track.lrc);
            if (!currentLyrics.length) {
                onLyricsStatus?.('empty');
                emitLyricFrame({ current: NO_LYRICS_TEXT, next: '' }, true);
                return;
            }
            onLyricsStatus?.('ready');
            syncLyricByTime();
        } catch {
            currentLyrics = [];
            onLyricsStatus?.('error');
            emitLyricFrame({ current: LYRICS_ERROR_TEXT, next: '' }, true);
        }
    };

    /**
     * 加载并应用新的播放源，同时尽量保留用户当前的播放/暂停意图。
     */
    const applySource = async (nextSource: PlayerSource) => {
        if (disposed) return;

        const shouldResumePlayback = !player.audio.paused;
        setPlayerSource(nextSource);
        setPlayerLoading();
        emitLyricFrame({ current: WAITING_TEXT, next: '' }, true);
        onLyricsStatus?.('loading');

        const needReload = player.sourceApi !== nextSource.playlistApi || !player.playlist.length;
        if (needReload) {
            player.sourceApi = nextSource.playlistApi;
            player.playlist = await fetchPlaylist(nextSource.playlistApi);
            player.index = 0;
            await selectTrack(0, shouldResumePlayback);
        } else {
            syncTrackStore();
            await loadCurrentLyrics();
            if (shouldResumePlayback && player.audio.paused) {
                try {
                    await player.audio.play();
                } catch {
                    setPlaying(false);
                }
            }
        }

        setPlaying(!player.audio.paused);
        setPlayerReady();
    };

    const selectTrack = async (targetIndex: number, autoPlay: boolean) => {
        if (!player.playlist.length) return;
        player.index = normalizeIndex(targetIndex, player.playlist.length);

        const track = player.playlist[player.index];
        if (!track?.url) {
            setPlayerError('当前歌曲资源地址无效。');
            return;
        }

        syncTrackStore();
        player.audio.src = track.url;
        player.audio.load();
        await loadCurrentLyrics();

        if (autoPlay) {
            try {
                await player.audio.play();
            } catch {
                setPlaying(false);
            }
        }
    };

    try {
        await applySource(source);
    } catch (error) {
        const message = error instanceof Error ? error.message : '播放器初始化失败';
        setPlayerError(message);
        onLyricsStatus?.('error');
        emitLyricFrame({ current: LYRICS_ERROR_TEXT, next: '' }, true);
        throw error;
    }

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
        void selectTrack(player.index + 1, true);
    };
    const onTimeUpdate = () => syncLyricByTime();

    player.audio.addEventListener('play', onPlay);
    player.audio.addEventListener('pause', onPause);
    player.audio.addEventListener('ended', onEnded);
    player.audio.addEventListener('timeupdate', onTimeUpdate);

    return {
        toggleMusic: () => {
            if (disposed) return;
            if (player.audio.paused) {
                void player.audio.play().catch(() => {
                    setPlaying(false);
                });
                return;
            }
            player.audio.pause();
        },
        playPrev: () => {
            if (disposed) return;
            void selectTrack(player.index - 1, true);
        },
        playNext: () => {
            if (disposed) return;
            void selectTrack(player.index + 1, true);
        },
        setSource: async (nextSource) => {
            if (disposed) return;
            try {
                await applySource(nextSource);
            } catch (error) {
                const message = error instanceof Error ? error.message : '播放器初始化失败';
                setPlayerError(message);
                onLyricsStatus?.('error');
                emitLyricFrame({ current: LYRICS_ERROR_TEXT, next: '' }, true);
            }
        },
        destroy: () => {
            if (disposed) return;
            disposed = true;
            unbindVolume();
            player.audio.removeEventListener('play', onPlay);
            player.audio.removeEventListener('pause', onPause);
            player.audio.removeEventListener('ended', onEnded);
            player.audio.removeEventListener('timeupdate', onTimeUpdate);
        },
    };
}
