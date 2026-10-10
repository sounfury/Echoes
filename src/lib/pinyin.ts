import { pinyin } from 'pinyin-pro';

export type PinyinSearchMeta = {
    full: string;
    initials: string;
};

export function buildPinyinSearchMeta(value: string): PinyinSearchMeta {
    const normalized = value.trim();
    if (!normalized) {
        return { full: '', initials: '' };
    }

    const full = pinyin(normalized, {
        toneType: 'none',
        type: 'array',
        nonZh: 'consecutive',
        v: false,
    })
        .map((part) => String(part).trim().toLowerCase())
        .filter(Boolean)
        .join('');

    const initials = pinyin(normalized, {
        pattern: 'first',
        toneType: 'none',
        type: 'array',
        nonZh: 'consecutive',
        v: false,
    })
        .map((part) => String(part).trim().toLowerCase())
        .filter(Boolean)
        .join('');

    return { full, initials };
}
