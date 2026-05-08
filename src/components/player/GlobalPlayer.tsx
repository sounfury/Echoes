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

type Props = {
    source: PlayerSource;
};

type PlayerSourceChangeEvent = CustomEvent<PlayerSource>;

/**
 * 在标题超出容器宽度时启用跑马灯，避免播放器窄宽度下文字被硬截断。
 */
function ScrollText({ text, className = "" }: { text: string; className?: string }) {
    const [isOverflowing, setIsOverflowing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        /**
         * 读取容器与文本宽度，判断当前文案是否需要滚动展示。
         */
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

/**
 * 全局播放器组件，负责音频控制、桌面歌词展示以及拖拽定位。
 */
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

    const [lyricsStatus, setLyricsStatus] = useState<LyricsStatus>('idle');
    const [lyrics, setLyrics] = useState<LyricsFrame>({
        current: 'WAITING FOR SIGNAL...',
        next: '',
    });
    const [trackTransitioning, setTrackTransitioning] = useState(false);
    const latestSourceRef = useRef(source);

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
        latestSourceRef.current = source;
    }, [source]);

    useEffect(() => {
        /**
         * 持久化播放器不会随着页面切换重建，因此需要主动监听页面广播的目标播放源。
         */
        const handleSourceChange = (event: Event) => {
            const nextSource = (event as PlayerSourceChangeEvent).detail;
            if (!nextSource || nextSource.playlistApi === latestSourceRef.current.playlistApi) {
                return;
            }

            latestSourceRef.current = nextSource;
            void controlsRef.current?.setSource(nextSource);
        };

        window.addEventListener('echoes:player-source-change', handleSourceChange as EventListener);
        return () => {
            window.removeEventListener('echoes:player-source-change', handleSourceChange as EventListener);
        };
    }, []);

    const [isMobileExpanded, setIsMobileExpanded] = useState(false);
    const isDraggingRef = useRef(false);
    const hasMovedRef = useRef(false);
    const dragStartPosRef = useRef({ x: 0, y: 0 });
    const currentTranslateRef = useRef({ x: 0, y: 0 });

    /**
     * 记录一次拖拽的起点，并避开按钮、音量条等可交互子元素。
     */
    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('input') || target.closest('.group\\/volume')) {
            return;
        }
        isDraggingRef.current = true;
        hasMovedRef.current = false;
        dragStartPosRef.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    /**
     * 直接同步播放器和歌词外层容器的位置，保证拖拽过程中两者始终共用同一位移。
     */
    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current) return;
        const dx = e.clientX - dragStartPosRef.current.x;
        const dy = e.clientY - dragStartPosRef.current.y;
        
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            hasMovedRef.current = true;
        }
        
        if (playerRef.current) {
            const newX = currentTranslateRef.current.x + dx;
            const newY = currentTranslateRef.current.y + dy;
            playerRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
            if (lyricsPanelRef.current) {
                // 歌词的开场动画放到内层面板执行，外层只负责拖拽位移，避免 transform 被动画覆盖。
                lyricsPanelRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
            }
        }
    };

    /**
     * 在指针释放时固化本次位移，为下一次拖拽提供新的基准点。
     */
    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
        
        const dx = e.clientX - dragStartPosRef.current.x;
        const dy = e.clientY - dragStartPosRef.current.y;
        currentTranslateRef.current.x += dx;
        currentTranslateRef.current.y += dy;
    };

    useEffect(() => {
        let disposed = false;
        setPlayerVisible(true);

        void initPlayerBridge({
            source: latestSourceRef.current,
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
                if (latestSourceRef.current.playlistApi !== source.playlistApi) {
                    void controls.setSource(latestSourceRef.current);
                }
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
        };
    }, []);

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
                className="fixed bottom-6 right-4 z-40 flex items-center gap-0 bg-white dark:bg-zinc-900 border border-eva-ink dark:border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] transition-[width,padding,max-width,opacity] rounded-full p-1 md:pr-2 md:pl-1 md:py-1 touch-none select-none cursor-move"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
            >
                <div
                    className="w-10 h-10 rounded-full bg-eva-purple flex items-center justify-center text-white animate-spin-slow overflow-hidden border border-black relative group/cover cursor-pointer md:cursor-auto shrink-0"
                    style={{ animationPlayState }}
                    onClick={() => {
                        if (hasMovedRef.current) return;
                        setIsMobileExpanded(!isMobileExpanded);
                    }}
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

                    <div className="absolute inset-0 z-20 hidden md:group-hover/cover:flex">
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

                <div 
                    className={`flex items-center transition-all duration-300 overflow-hidden ${isMobileExpanded ? 'max-w-[160px] opacity-100 ml-2' : 'max-w-0 opacity-0 ml-0 md:max-w-[400px] md:opacity-100 md:ml-0'}`}
                >
                    {/* Mobile Basic Controls (Visible only on mobile expanded) */}
                    <div className="flex md:hidden items-center gap-3 px-1 text-eva-ink dark:text-white pb-0.5">
                        <button 
                            className="hover:opacity-70 transition-opacity" 
                            onClick={(e) => { e.stopPropagation(); controlsRef.current?.playPrev(); }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"></path></svg>
                        </button>
                        <button 
                            className="hover:text-eva-purple transition-colors disabled:opacity-40" 
                            onClick={(e) => { e.stopPropagation(); controlsRef.current?.toggleMusic(); }}
                            disabled={isTrackBootLoading}
                        >
                            {isPlaying ? (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M8 5.14v13.72c0 .77.83 1.25 1.5.86l10-6.86a1 1 0 0 0 0-1.72l-10-6.86A1 1 0 0 0 8 5.14z"></path></svg>
                            )}
                        </button>
                        <button 
                            className="hover:opacity-70 transition-opacity" 
                            onClick={(e) => { e.stopPropagation(); controlsRef.current?.playNext(); }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M16 6h2v12h-2zm-8.5 6l-8.5 6V6z"></path></svg>
                        </button>
                    </div>

                    {/* Desktop Full Controls (Hidden on mobile) */}
                    <div className="hidden md:flex items-center">
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
                            <span className="w-1 bg-eva-purple animate-sound-wave" style={{ animationDelay: '0s', animationPlayState }} />
                            <span className="w-1 bg-eva-green animate-sound-wave" style={{ animationDelay: '0.2s', animationPlayState }} />
                            <span className="w-1 bg-eva-red animate-sound-wave" style={{ animationDelay: '0.4s', animationPlayState }} />
                            <span className="w-1 bg-eva-orange animate-sound-wave" style={{ animationDelay: '0.1s', animationPlayState }} />
                        </button>

                        <button
                            className="hover:text-eva-purple transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-wait"
                            onClick={() => controlsRef.current?.toggleMusic()}
                            aria-label={isPlaying ? 'Pause' : 'Play'}
                            disabled={isTrackBootLoading}
                        >
                            {isPlaying ? (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                                    <rect x="6" y="5" width="4" height="14" rx="1"></rect>
                                    <rect x="14" y="5" width="4" height="14" rx="1"></rect>
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
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
                    </div>
                </div>
            </div>

            <div
                id="lyrics-panel"
                ref={lyricsPanelRef}
                className={`fixed bottom-24 right-6 z-30 ${isLyricsOpen ? 'hidden md:block' : 'hidden'}`}
            >
                <div
                    className={`relative w-64 bg-white dark:bg-zinc-900 border-2 border-eva-ink dark:border-white p-4 shadow-[4px_4px_0px_0px_currentColor] origin-bottom-right ${isLyricsOpen ? 'animate-fade-in' : ''}`}
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
            </div>
        </>
    );
}
