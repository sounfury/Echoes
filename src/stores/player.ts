import { atom } from 'nanostores';

export type PlayerStatus = 'idle' | 'loading' | 'ready' | 'error';

export type PlayerSource = {
    playlistApi: string;
    raw?: string;
};

export interface TrackInfo {
    title: string;
    artist: string;
    url?: string;
    cover?: string;
    lrc?: string;
}

export const $playerStatus = atom<PlayerStatus>('idle');
export const $playerError = atom<string | null>(null);

export const $isPlaying = atom(false);
export const $currentTrack = atom<TrackInfo | null>(null);
export const $playList = atom<TrackInfo[]>([]);
export const $isPlayerVisible = atom(false);
export const $lyricsOpen = atom(false);
export const $playlistSource = atom<PlayerSource | null>(null);

export function setPlayerLoading() {
    $playerStatus.set('loading');
    $playerError.set(null);
}

export function setPlayerReady() {
    $playerStatus.set('ready');
    $playerError.set(null);
}

export function setPlayerError(message: string) {
    $playerStatus.set('error');
    $playerError.set(message);
}

export function setPlaying(isPlaying: boolean) {
    $isPlaying.set(isPlaying);
}

export function setCurrentTrack(track: TrackInfo | null) {
    $currentTrack.set(track);
}

export function setPlayList(playList: TrackInfo[]) {
    $playList.set(playList);
}

export function setPlayerVisible(visible: boolean) {
    $isPlayerVisible.set(visible);
}

export function setPlayerSource(source: PlayerSource | null) {
    $playlistSource.set(source);
}

export function toggleLyrics() {
    $lyricsOpen.set(!$lyricsOpen.get());
}

export function closeLyrics() {
    $lyricsOpen.set(false);
}

export function resetPlayerState() {
    $playerStatus.set('idle');
    $playerError.set(null);
    $isPlaying.set(false);
    $currentTrack.set(null);
    $playList.set([]);
    $lyricsOpen.set(false);
}
