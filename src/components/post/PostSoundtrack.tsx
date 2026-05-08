import { useEffect, useState } from 'react';
import {
    $currentTrack,
    $playerStatus,
    $playlistSource,
    type PlayerSource,
    type PlayerStatus,
    type TrackInfo,
} from '../../stores/player';

type Props = {
    sourceApi: string;
};

/**
 * 根据播放器当前状态，推导文章头部应显示的配乐文案。
 */
function resolveSoundtrackLabel(
    sourceApi: string,
    currentSource: PlayerSource | null,
    currentTrack: TrackInfo | null,
    playerStatus: PlayerStatus,
): string {
    if (currentSource?.playlistApi !== sourceApi) {
        return 'SYNCING...';
    }

    if (currentTrack?.title?.trim()) {
        return currentTrack.title.trim();
    }

    if (playerStatus === 'error') {
        return 'UNAVAILABLE';
    }

    return 'SYNCING...';
}

/**
 * 展示文章配乐标题，并在播放器切源或歌曲元信息加载完成后自动刷新。
 */
export default function PostSoundtrack({ sourceApi }: Props) {
    const [currentSource, setCurrentSource] = useState($playlistSource.get());
    const [currentTrack, setCurrentTrack] = useState($currentTrack.get());
    const [playerStatus, setPlayerStatus] = useState($playerStatus.get());

    useEffect(() => {
        const unbindSource = $playlistSource.listen(setCurrentSource);
        const unbindTrack = $currentTrack.listen(setCurrentTrack);
        const unbindStatus = $playerStatus.listen(setPlayerStatus);

        return () => {
            unbindSource();
            unbindTrack();
            unbindStatus();
        };
    }, []);

    const label = resolveSoundtrackLabel(sourceApi, currentSource, currentTrack, playerStatus);

    return <span>{label}</span>;
}
