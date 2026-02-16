import { useEffect, useRef, useState } from 'react';
import {
    $currentTrack,
    $isPlayerVisible,
    $isPlaying,
    $lyricsOpen,
    $playerError,
    $playerStatus,
    closeLyrics,
    setPlayerVisible,
    toggleLyrics,
    type PlayerSource,
} from '../../stores/player';
import {
    initPlayerBridge,
    type LyricsFrame,
    type PlayerBridgeControls,
} from '../../lib/client/playerBridge';

type LyricsStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

type SwipePoint = {
    x: number;
    y: number;
};

const SWIPE_THRESHOLD = 50;

type Props = {
    source: PlayerSource;
};

export default function GlobalPlayer({ source }: Props) {
    const [playerStatus, setPlayerStatusState] = useState($playerStatus.get());
    const [playerError, setPlayerErrorState] = useState($playerError.get());
    const [currentTrack, setCurrentTrackState] = useState($currentTrack.get());
    const [isPlaying, setIsPlayingState] = useState($isPlaying.get());
    const [isPlayerVisible, setIsPlayerVisibleState] = useState($isPlayerVisible.get());
    const [isLyricsOpen, setIsLyricsOpenState] = useState($lyricsOpen.get());

    const controlsRef = useRef<PlayerBridgeControls | null>(null);
    const playerRef = useRef<HTMLDivElement | null>(null);
    const lyricsPanelRef = useRef<HTMLDivElement | null>(null);
    const swipeStartRef = useRef<SwipePoint | null>(null);
    const feedbackTimerRef = useRef<number | null>(null);

    const [lyricsStatus, setLyricsStatus] = useState<LyricsStatus>('idle');
    const [lyrics, setLyrics] = useState<LyricsFrame>({
        current: 'WAITING FOR SIGNAL...',
        next: '',
    });
    const [gestureFeedback, setGestureFeedback] = useState<'PREV' | 'NEXT' | null>(null);
    const [trackTransitioning, setTrackTransitioning] = useState(false);

    useEffect(() => {
        const unbindStatus = $playerStatus.listen(setPlayerStatusState);
        const unbindError = $playerError.listen(setPlayerErrorState);
        const unbindTrack = $currentTrack.listen(setCurrentTrackState);
        const unbindPlaying = $isPlaying.listen(setIsPlayingState);
        const unbindVisible = $isPlayerVisible.listen(setIsPlayerVisibleState);
        const unbindLyricsOpen = $lyricsOpen.listen(setIsLyricsOpenState);

        return () => {
            unbindStatus();
            unbindError();
            unbindTrack();
            unbindPlaying();
            unbindVisible();
            unbindLyricsOpen();
        };
    }, []);

    useEffect(() => {
        let disposed = false;
        setPlayerVisible(true);

        void initPlayerBridge({
            source,
            onLyricFrame: (payload) => {
                if (disposed) return;
                setLyrics(payload);
            },
            onLyricsStatus: (status) => {
                if (disposed) return;
                setLyricsStatus(status);
            },
        })
            .then((controls) => {
                if (disposed) {
                    controls.destroy();
                    return;
                }
                controlsRef.current = controls;
            })
            .catch(() => {
                // 错误状态已在 store 中设置，这里无需重复处理
            });

        return () => {
            disposed = true;
            controlsRef.current?.destroy();
            controlsRef.current = null;
            closeLyrics();
            setPlayerVisible(false);
            if (feedbackTimerRef.current) {
                window.clearTimeout(feedbackTimerRef.current);
                feedbackTimerRef.current = null;
            }
        };
    }, [source.playlistApi]);

    useEffect(() => {
        if (!isLyricsOpen) return;

        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (playerRef.current?.contains(target)) return;
            if (lyricsPanelRef.current?.contains(target)) return;
            closeLyrics();
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeLyrics();
            }
        };

        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [isLyricsOpen]);

    useEffect(() => {
        if (!currentTrack) return;
        setTrackTransitioning(true);
        const timer = window.setTimeout(() => {
            setTrackTransitioning(false);
        }, 260);
        return () => {
            window.clearTimeout(timer);
        };
    }, [currentTrack?.title, currentTrack?.artist, currentTrack?.cover]);

    const isTrackBootLoading = playerStatus === 'loading' && !currentTrack;
    const animationPlayState = isPlaying || isTrackBootLoading ? 'running' : 'paused';

    const showGestureFeedback = (text: 'PREV' | 'NEXT') => {
        setGestureFeedback(text);
        if (feedbackTimerRef.current) {
            window.clearTimeout(feedbackTimerRef.current);
        }
        feedbackTimerRef.current = window.setTimeout(() => {
            setGestureFeedback(null);
        }, 700);
    };

    const handleSwipe = (endPoint: SwipePoint) => {
        const start = swipeStartRef.current;
        swipeStartRef.current = null;
        if (!start) return;

        const diffX = endPoint.x - start.x;
        const diffY = endPoint.y - start.y;

        if (Math.abs(diffX) <= Math.abs(diffY) || Math.abs(diffX) < SWIPE_THRESHOLD) {
            return;
        }

        if (diffX > 0) {
            controlsRef.current?.playPrev();
            showGestureFeedback('PREV');
            return;
        }

        controlsRef.current?.playNext();
        showGestureFeedback('NEXT');
    };

    if (!isPlayerVisible && playerStatus === 'idle') {
        return null;
    }

    const coverStyle = currentTrack?.cover
        ? { backgroundImage: `url('${currentTrack.cover}')` }
        : undefined;

    return (
        <>
            <div
                id="global-player"
                ref={playerRef}
                className="fixed bottom-6 right-6 z-40 flex items-center gap-0 bg-white dark:bg-zinc-900 border border-eva-ink dark:border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] transition-all rounded-full pr-4 pl-1 py-1 max-w-[220px] md:max-w-none touch-none select-none"
                onTouchStart={(e) => {
                    const point = e.touches[0];
                    swipeStartRef.current = { x: point.clientX, y: point.clientY };
                }}
                onTouchEnd={(e) => {
                    const point = e.changedTouches[0];
                    handleSwipe({ x: point.clientX, y: point.clientY });
                }}
                onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    swipeStartRef.current = { x: e.clientX, y: e.clientY };
                }}
                onMouseUp={(e) => {
                    handleSwipe({ x: e.clientX, y: e.clientY });
                }}
                onMouseLeave={() => {
                    swipeStartRef.current = null;
                }}
            >
                <div
                    className="w-10 h-10 rounded-full bg-eva-purple flex items-center justify-center text-white animate-spin-slow overflow-hidden border border-black relative group/cover"
                    style={{ animationPlayState }}
                >
                    <div
                        className={`absolute inset-0 bg-cover transition-all duration-300 ${isTrackBootLoading
                            ? 'opacity-75 scale-100 blur-0 bg-gradient-to-br from-eva-purple/50 to-eva-green/35 animate-pulse'
                            : trackTransitioning
                                ? 'opacity-45 scale-95 blur-[1px]'
                                : 'opacity-80 scale-100 blur-0'
                            }`}
                        style={coverStyle}
                    />

                    <div className="absolute inset-0 z-20 hidden group-hover/cover:flex">
                        <button
                            className="w-1/2 h-full flex items-center justify-center bg-black/30 hover:bg-black/50 text-white text-[9px] transition-colors cursor-pointer"
                            onClick={(event) => {
                                event.stopPropagation();
                                controlsRef.current?.playPrev();
                            }}
                            aria-label="Previous track"
                        >
                            {'<'}
                        </button>
                        <button
                            className="w-1/2 h-full flex items-center justify-center bg-black/30 hover:bg-black/50 text-white text-[9px] transition-colors cursor-pointer"
                            onClick={(event) => {
                                event.stopPropagation();
                                controlsRef.current?.playNext();
                            }}
                            aria-label="Next track"
                        >
                            {'>'}
                        </button>
                    </div>
                </div>

                <button
                    className="flex flex-col mx-3 w-24 md:w-32 overflow-hidden text-left cursor-pointer hover:opacity-70 transition-opacity"
                    onClick={() => toggleLyrics()}
                    aria-label="Toggle lyrics panel"
                >
                    {isTrackBootLoading ? (
                        <>
                            <span className="block h-[10px] w-20 rounded bg-eva-ink/20 dark:bg-white/20 animate-pulse" />
                            <span className="block h-[8px] w-14 rounded mt-1 bg-eva-ink/15 dark:bg-white/15 animate-pulse" />
                        </>
                    ) : (
                        <>
                            <span className={`text-[10px] font-bold font-serif truncate transition-all duration-300 ${trackTransitioning ? 'opacity-30 translate-y-1' : 'opacity-100 translate-y-0'
                                }`}>
                                {currentTrack?.title ?? 'Loading Stream...'}
                            </span>
                            <span className={`text-[8px] font-mono truncate transition-all duration-300 ${trackTransitioning ? 'opacity-25 translate-y-1' : 'opacity-60 translate-y-0'
                                }`}>
                                {currentTrack?.artist ?? 'NETEASE // CLOUD'}
                            </span>
                        </>
                    )}
                </button>

                <button
                    className="flex items-end gap-[2px] h-4 mr-2 cursor-pointer hover:opacity-70 transition-opacity"
                    onClick={() => toggleLyrics()}
                    aria-label="Toggle lyrics panel"
                >
                    <span
                        className="w-1 bg-eva-purple animate-sound-wave"
                        style={{ animationDelay: '0s', animationPlayState }}
                    />
                    <span
                        className="w-1 bg-eva-green animate-sound-wave"
                        style={{ animationDelay: '0.2s', animationPlayState }}
                    />
                    <span
                        className="w-1 bg-eva-red animate-sound-wave"
                        style={{ animationDelay: '0.4s', animationPlayState }}
                    />
                    <span
                        className="w-1 bg-eva-orange animate-sound-wave"
                        style={{ animationDelay: '0.1s', animationPlayState }}
                    />
                </button>

                <button
                    className="hover:text-eva-purple transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-wait"
                    onClick={() => controlsRef.current?.toggleMusic()}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                    disabled={isTrackBootLoading}
                >
                    {isPlaying ? (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="w-4 h-4"
                            aria-hidden="true"
                        >
                            <rect x="6" y="5" width="4" height="14" rx="1"></rect>
                            <rect x="14" y="5" width="4" height="14" rx="1"></rect>
                        </svg>
                    ) : (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="w-4 h-4"
                            aria-hidden="true"
                        >
                            <path d="M8 5.14v13.72c0 .77.83 1.25 1.5.86l10-6.86a1 1 0 0 0 0-1.72l-10-6.86A1 1 0 0 0 8 5.14z"></path>
                        </svg>
                    )}
                </button>

                {gestureFeedback && (
                    <div className="absolute -top-8 right-4 text-[10px] font-mono px-2 py-0.5 border border-eva-ink dark:border-white bg-white dark:bg-zinc-900 animate-fade-in">
                        {gestureFeedback}
                    </div>
                )}
            </div>

            <div
                id="lyrics-panel"
                ref={lyricsPanelRef}
                className={`fixed bottom-24 right-6 w-64 bg-white dark:bg-zinc-900 border-2 border-eva-ink dark:border-white p-4 shadow-[4px_4px_0px_0px_currentColor] z-30 origin-bottom-right ${isLyricsOpen ? 'animate-fade-in' : 'hidden'
                    }`}
            >
                <div className="absolute -bottom-2 right-8 w-4 h-4 bg-white dark:bg-zinc-900 border-r-2 border-b-2 border-eva-ink dark:border-white transform rotate-45" />
                <div className="text-center font-serif text-sm leading-relaxed h-28 overflow-hidden flex flex-col justify-center items-center">
                    <p key={`lyrics-current-${lyrics.current}`} className="font-bold text-eva-purple transform scale-105 origin-center animate-fade-in">
                        {lyrics.current}
                    </p>
                    {lyrics.next && (
                        <p key={`lyrics-next-${lyrics.next}`} className="text-xs mt-2 opacity-40 animate-fade-in">{lyrics.next}</p>
                    )}
                    {lyricsStatus === 'loading' && (
                        <p className="text-xs opacity-50 font-mono mt-2">SYNCING...</p>
                    )}
                </div>
                {playerStatus === 'error' && (
                    <p className="text-[10px] font-mono text-eva-red mt-3">
                        {playerError ?? '播放器初始化失败'}
                    </p>
                )}
            </div>
        </>
    );
}
