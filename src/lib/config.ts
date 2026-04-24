/**
 * 站点配置解析
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { z } from 'zod';
import type { PlayerSource } from '../stores/player';

const navItemSchema = z.object({
    name: z.string(),
    path: z.string(),
    icon: z.string().optional(),
    external: z.boolean().optional(),
});

const categoryConfigSchema = z.object({
    label: z.string(),
    desc: z.string(),
    color: z.string(),
});

const barkTemplateSchema = z.object({
    title: z.string(),
    body: z.string(),
});

const walineMetaSchema = z.enum(['nick', 'mail', 'link']);
const walineLoginSchema = z.enum(['enable', 'disable', 'force']);

const siteConfigSchema = z.object({
    site: z.object({
        title: z.string(),
        subtitle: z.string(),
        description: z.string(),
        url: z.string().url(),
        author: z.string(),
        logoText: z.string(),
        timezone: z.string(),
        icp: z.string().optional(),
    }),
    theme: z.object({
        defaultMode: z.enum(['light', 'dark']),
        colors: z.object({
            accent: z.string(),
            terminal: z.string(),
            warning: z.string(),
            defaultCategory: z.string(),
            light: z.object({
                bg: z.string(),
                bgSecondary: z.string(),
                text: z.string(),
                textSecondary: z.string(),
                border: z.string(),
            }),
            dark: z.object({
                bg: z.string(),
                bgSecondary: z.string(),
                text: z.string(),
                textSecondary: z.string(),
                border: z.string(),
            }),
        }),
    }),
    navigation: z.array(navItemSchema),
    timeline: z.object({
        pageSize: z.number().int().positive().default(5),
    }).default({
        pageSize: 5,
    }),
    category: z.record(categoryConfigSchema),
    bgm: z.object({
        enabled: z.boolean(),
        playlistApi: z.string().url().optional(),
        defaultPlaylist: z.array(z.string()).default([]),
    }),
    comment: z.object({
        enabled: z.boolean().default(false),
        serverUrl: z.string().url().default('https://comments.example.com'),
        lang: z.string().default('zh-CN'),
        meta: z.array(walineMetaSchema).default(['nick', 'mail', 'link']),
        requiredMeta: z.array(walineMetaSchema).default(['nick']),
        login: walineLoginSchema.default('disable'),
        pageSize: z.number().int().positive().default(10),
        reaction: z.boolean().default(false),
    }).default({
        enabled: false,
        serverUrl: 'https://comments.example.com',
        lang: 'zh-CN',
        meta: ['nick', 'mail', 'link'],
        requiredMeta: ['nick'],
        login: 'disable',
        pageSize: 10,
        reaction: false,
    }),
    ops: z.object({
        bark: z.object({
            enabled: z.boolean(),
            deviceKeyEnv: z.string().optional(),
            iconUrl: z.string().url(),
            templates: z.object({
                deployOnly: barkTemplateSchema,
                batchPublish: barkTemplateSchema,
                singlePublish: barkTemplateSchema,
            }),
        }),
    }),
});

export type NavItem = z.infer<typeof navItemSchema>;
export type CategoryConfig = z.infer<typeof categoryConfigSchema>;
export type SiteConfig = z.infer<typeof siteConfigSchema>;

const configPath = path.resolve(process.cwd(), 'src/config/site.config.yaml');
let cachedConfig: SiteConfig | null = null;
let cachedConfigMtime = -1;
let lastMtimeCheckAt = 0;
const SHOULD_WATCH_CONFIG_CHANGES = process.env.NODE_ENV !== 'production';
const MTIME_CHECK_INTERVAL_MS = 1000;

function loadSiteConfig(): SiteConfig {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = yaml.load(raw);
    const validated = siteConfigSchema.safeParse(parsed);
    if (!validated.success) {
        const issues = validated.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
        throw new Error(`Invalid site.config.yaml: ${issues}`);
    }
    return validated.data;
}

export function getSiteConfig(): SiteConfig {
    if (!cachedConfig) {
        cachedConfig = loadSiteConfig();
        cachedConfigMtime = fs.statSync(configPath).mtimeMs;
        return cachedConfig;
    }

    if (!SHOULD_WATCH_CONFIG_CHANGES) {
        return cachedConfig;
    }

    const now = Date.now();
    if (now - lastMtimeCheckAt < MTIME_CHECK_INTERVAL_MS) {
        return cachedConfig;
    }
    lastMtimeCheckAt = now;

    const currentMtime = fs.statSync(configPath).mtimeMs;
    if (currentMtime !== cachedConfigMtime) {
        cachedConfig = loadSiteConfig();
        cachedConfigMtime = currentMtime;
    }
    return cachedConfig;
}

const DEFAULT_METING_API_ORIGIN = 'https://api.injahow.cn/meting/';

function buildPlaylistApiById(id: string): string {
    const api = new URL(DEFAULT_METING_API_ORIGIN);
    api.searchParams.set('type', 'playlist');
    api.searchParams.set('id', id);
    return api.toString();
}


function parsePlaylistIdFromMusic163(url: URL): string | null {
    const directId = url.searchParams.get('id')?.trim();
    if (directId && /playlist/.test(url.pathname)) return directId;

    const cleanHash = url.hash.replace(/^#\/?/, '');
    if (!cleanHash) return null;

    const [route, queryString = ''] = cleanHash.split('?');
    if (!route.includes('playlist')) return null;

    const query = new URLSearchParams(queryString);
    return query.get('id')?.trim() ?? null;
}

function parseSongIdFromMusic163(url: URL): string | null {
    const directId = url.searchParams.get('id')?.trim();
    if (directId && /song/.test(url.pathname)) return directId;

    const cleanHash = url.hash.replace(/^#\/?/, '');
    if (!cleanHash) return null;

    const [route, queryString = ''] = cleanHash.split('?');
    if (!route.includes('song')) return null;

    const query = new URLSearchParams(queryString);
    return query.get('id')?.trim() ?? null;
}

/**
 * 兼容三种配置输入：
 * 1) meting playlist API URL
 * 2) 网易 playlist URL
 * 3) 纯数字歌单 ID
 */
export function parsePlayerSource(rawValue: string): PlayerSource | null {
    const raw = rawValue.trim();
    if (!raw) return null;

    if (/^\d+$/.test(raw)) {
        return {
            playlistApi: buildPlaylistApiById(raw),
            raw,
        };
    }

    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        return null;
    }

    const isMetingApi = /(^|\.)api\.injahow\.cn$/i.test(url.hostname)
        && url.pathname.startsWith('/meting/')
        && url.searchParams.get('type') === 'playlist'
        && Boolean(url.searchParams.get('id'));
    if (isMetingApi) {
        return {
            playlistApi: url.toString(),
            raw,
        };
    }

    const isMusic163 = /(^|\.)music\.163\.com$/i.test(url.hostname);
    if (!isMusic163) return null;

    const id = parsePlaylistIdFromMusic163(url);
    if (!id) return null;

    return {
        playlistApi: buildPlaylistApiById(id),
        raw,
    };
}

export function getDefaultPlayerSource(config = getSiteConfig()): PlayerSource | null {
    if (config.bgm.playlistApi) {
        const parsed = parsePlayerSource(config.bgm.playlistApi);
        if (parsed) return parsed;
    }

    for (const entry of config.bgm.defaultPlaylist) {
        const parsed = parsePlayerSource(entry);
        if (parsed) return parsed;
    }

    return null;
}


export function getPostMusicSource(rawValue: string | null | undefined): PlayerSource | null {
    const raw = rawValue?.trim();
    if (!raw) return null;

    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        return null;
    }

    const isMusic163 = /(^|\.)music\.163\.com$/i.test(url.hostname);
    if (!isMusic163) return null;

    const id = parseSongIdFromMusic163(url);
    if (!id) return null;

    const api = new URL(DEFAULT_METING_API_ORIGIN);
    api.searchParams.set('server', 'netease');
    api.searchParams.set('type', 'song');
    api.searchParams.set('id', id);

    return {
        playlistApi: api.toString(),
        raw,
    };
}
