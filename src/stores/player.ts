import { atom } from 'nanostores';

export interface TrackInfo {
    title: string;
    artist: string;
    url: string;
    cover?: string;
}

export const $isPlaying = atom(false);
export const $currentTrack = atom<TrackInfo | null>(null);
export const $playList = atom<TrackInfo[]>([]);
export const $isPlayerVisible = atom(false);
