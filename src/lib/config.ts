import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export interface NavItem {
    name: string;
    path: string;
    icon?: string;
    external?: boolean;
}

// Category 映射到配置键，slug 由键名决定
export interface CategoryConfig {
    label: string;
    desc: string;
    color: string;
}

export interface SiteConfig {
    site: {
        title: string;
        subtitle: string;
        url: string;
        author: string;
        logoText: string;
        timezone: string;
    };
    theme: {
        defaultMode: 'light' | 'dark';
        colors: {
            accent: string;
            terminal: string;
            warning: string;
            defaultCategory: string;
            light: {
                bg: string;
                bgSecondary: string;
                text: string;
                textSecondary: string;
                border: string;
            };
            dark: {
                bg: string;
                bgSecondary: string;
                text: string;
                textSecondary: string;
                border: string;
            };
        };
    };
    navigation: NavItem[];
    category: Record<string, CategoryConfig>;
    // Phase 2
    bgm: {
        enabled: boolean;
        defaultPlaylist: string[];
    };
    ops: {
        bark: {
            enabled: boolean;
            deviceKeyEnv: string;
            iconUrl: string;
        };
    };
}

/**
 * 模块级缓存：默认复用内存配置；当文件 mtime 变化时自动失效重载
 */
const configPath = path.resolve(process.cwd(), 'src/config/site.config.yaml');
let cachedConfig: SiteConfig | null = null;
let cachedConfigMtime = -1;

function loadSiteConfig(): SiteConfig {
    const raw = fs.readFileSync(configPath, 'utf-8');
    return yaml.load(raw) as SiteConfig;
}

export function getSiteConfig(): SiteConfig {
    const currentMtime = fs.statSync(configPath).mtimeMs;
    if (!cachedConfig || currentMtime !== cachedConfigMtime) {
        cachedConfig = loadSiteConfig();
        cachedConfigMtime = currentMtime;
    }
    return cachedConfig;
}
