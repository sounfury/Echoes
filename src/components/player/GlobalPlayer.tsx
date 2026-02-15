import { useStore } from '@nanostores/react';
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
    const playerStatus = useStore($playerStatus);
    const playerError = useStore($playerError);
    const currentTrack = useStore($currentTrack);
    const isPlaying = useStore($isPlaying);
    const isPlayerVisible = useStore($isPlayerVisible);
    const isLyricsOpen = useStore($lyricsOpen);

    const controlsRef = useRef<PlayerBridgeControls | null>(null);
    const swipeStartRef = useRef<SwipePoint | null>(null);
    const feedbackTimerRef = useRef<number | null>(null);

    const [lyricsStatus, setLyricsStatus] = useState<LyricsStatus>('idle');
    const [lyrics, setLyrics] = useState<LyricsFrame>({
        current: 'WAITING FOR SIGNAL...',
        next: '',
    });
    const [gestureFeedback, setGestureFeedback] = useState<'PREV' | 'NEXT' | null>(null);

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

    const animationPlayState = isPlaying ? 'running' : 'paused';

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
                        className="absolute inset-0 bg-cover opacity-80 transition-all duration-500"
                        style={coverStyle}
                    />
                    <span className="relative z-10 text-[10px] font-bold group-hover/cover:hidden">
                        NOTE
                    </span>

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
                    <span className="text-[10px] font-bold font-serif truncate">
                        {currentTrack?.title ?? 'Loading Stream...'}
                    </span>
                    <span className="text-[8px] font-mono opacity-60 truncate">
                        {currentTrack?.artist ?? 'NETEASE // CLOUD'}
                    </span>
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
                    className="hover:text-eva-purple transition-colors cursor-pointer font-mono text-sm"
                    onClick={() => controlsRef.current?.toggleMusic()}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                    {isPlaying ? '||' : '>'}
                </button>

                {gestureFeedback && (
                    <div className="absolute -top-8 right-4 text-[10px] font-mono px-2 py-0.5 border border-eva-ink dark:border-white bg-white dark:bg-zinc-900 animate-fade-in">
                        {gestureFeedback}
                    </div>
                )}
            </div>

            <div
                id="lyrics-panel"
                className={`fixed bottom-24 right-6 w-64 bg-white dark:bg-zinc-900 border-2 border-eva-ink dark:border-white p-4 shadow-[4px_4px_0px_0px_currentColor] z-30 origin-bottom-right ${isLyricsOpen ? 'animate-fade-in' : 'hidden'
                    }`}
            >
                <div className="absolute -bottom-2 right-8 w-4 h-4 bg-white dark:bg-zinc-900 border-r-2 border-b-2 border-eva-ink dark:border-white transform rotate-45" />
                <div className="text-right mb-2">
                    <button
                        className="text-[10px] font-mono opacity-50 hover:opacity-100 cursor-pointer"
                        onClick={() => closeLyrics()}
                        aria-label="Close lyrics panel"
                    >
                        CLOSE
                    </button>
                </div>
                <div className="text-center font-serif text-sm leading-relaxed h-32 overflow-hidden flex flex-col justify-center items-center">
                    <p className="font-bold text-eva-purple transition-all duration-300 transform scale-105 origin-center">
                        {lyrics.current}
                    </p>
                    {lyrics.next && (
                        <p className="text-xs opacity-40 mt-2">{lyrics.next}</p>
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
