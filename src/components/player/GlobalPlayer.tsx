import { useEffect, useRef, useState } from 'react';
import {
    $currentTrack,
    $isPlayerVisible,
    $isPlaying,
    $lyricsOpen,
    $playerError,
    $playerStatus,
    $volume,
    closeLyrics,
    setPlayerVisible,
    setVolume,
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

function ScrollText({ text, className = "" }: { text: string; className?: string }) {
    const [isOverflowing, setIsOverflowing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const check = () => {
            if (containerRef.current && textRef.current) {
                setIsOverflowing(textRef.current.offsetWidth > containerRef.current.offsetWidth);
            }
        };
        check();
        const observer = new ResizeObserver(check);
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [text]);

    return (
        <div ref={containerRef} className={`overflow-hidden whitespace-nowrap w-full relative ${className}`}>
            <div 
                className={`flex w-max`}
                style={isOverflowing ? { animation: 'ev-scroll-left 8s linear infinite' } : {}}
            >
                <span ref={textRef} className="block">{text}</span>
                {isOverflowing && (
                    <>
                        <span className="inline-block w-4" />
                        <span className="block">{text}</span>
                        <span className="inline-block w-4" />
                    </>
                )}
            </div>
            {isOverflowing && (
                <style>{`
                    @keyframes ev-scroll-left {
                        0% { transform: translateX(0); }
                        100% { transform: translateX(-50%); }
                    }
                `}</style>
            )}
        </div>
    );
}

export default function GlobalPlayer({ source }: Props) {
    const [playerStatus, setPlayerStatusState] = useState($playerStatus.get());
    const [playerError, setPlayerErrorState] = useState($playerError.get());
    const [currentTrack, setCurrentTrackState] = useState($currentTrack.get());
    const [isPlaying, setIsPlayingState] = useState($isPlaying.get());
    const [isPlayerVisible, setIsPlayerVisibleState] = useState($isPlayerVisible.get());
    const [isLyricsOpen, setIsLyricsOpenState] = useState($lyricsOpen.get());
    const [volume, setVolumeState] = useState($volume.get());

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
        const unbindVolume = $volume.listen(setVolumeState);

        return () => {
            unbindStatus();
            unbindError();
            unbindTrack();
            unbindPlaying();
            unbindVisible();
            unbindLyricsOpen();
            unbindVolume();
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
                className="fixed bottom-6 right-4 z-40 flex items-center gap-0 bg-white dark:bg-zinc-900 border border-eva-ink dark:border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] transition-all rounded-full pr-2 pl-1 py-1 max-w-[220px] md:max-w-none touch-none select-none"
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
                    className="flex flex-col mx-2 w-16 md:w-24 overflow-hidden text-left cursor-pointer hover:opacity-70 transition-opacity"
                    onClick={() => toggleLyrics()}
                    aria-label="Toggle lyrics panel"
                >
                    {isTrackBootLoading ? (
                        <>
                            <span className="block h-[10px] w-14 rounded bg-eva-ink/20 dark:bg-white/20 animate-pulse" />
                            <span className="block h-[8px] w-10 rounded mt-1 bg-eva-ink/15 dark:bg-white/15 animate-pulse" />
                        </>
                    ) : (
                        <>
                            <ScrollText
                                text={currentTrack?.title ?? 'Loading'} 
                                className={`text-[10px] font-bold font-serif transition-all duration-300 ${trackTransitioning ? 'opacity-30 translate-y-1' : 'opacity-100 translate-y-0'}`} />
                            <ScrollText
                                text={currentTrack?.artist ?? 'NETEASE'} 
                                className={`text-[8px] font-mono mt-0.5 transition-all duration-300 ${trackTransitioning ? 'opacity-25 translate-y-1' : 'opacity-60 translate-y-0'}`} />
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

                <div className="hidden md:flex flex-row items-center group/volume ml-3 mr-1 relative">
                    <div 
                        className="text-eva-ink/40 dark:text-white/40 group-hover/volume:text-eva-purple transition-colors flex items-center justify-center cursor-pointer" 
                        aria-hidden="true" 
                        onClick={() => setVolume(volume === 0 ? 0.25 : 0)}
                        title={volume === 0 ? "取消静音" : "静音"}
                    >
                        {volume === 0 ? (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-[14px] h-[14px]"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
                        ) : volume < 0.5 ? (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-[14px] h-[14px]"><path d="M3 9v6h4l5 5V4L7 9H3zm11.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" /></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-[14px] h-[14px]"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
                        )}
                    </div>
                    
                    <div className="w-0 overflow-hidden group-hover/volume:w-14 group-hover/volume:ml-1.5 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex items-center opacity-0 group-hover/volume:opacity-100 origin-left">
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={volume}
                            onChange={(e) => setVolume(parseFloat(e.target.value))}
                            className="w-full h-[3px] bg-eva-ink/20 dark:bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-eva-purple focus:outline-none transition-transform active:[&::-webkit-slider-thumb]:scale-125 hover:[&::-webkit-slider-thumb]:scale-125"
                            aria-label="Volume Control"
                            title={`音量: ${Math.round(volume * 100)}%`}
                        />
                    </div>
                </div>

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
