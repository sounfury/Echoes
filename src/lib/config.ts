import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export interface NavItem {
    name: string;
    path: string;
    icon?: string;
    external?: boolean;
}

export interface CategoryConfig {
    slug: string;
    label: string;
    desc: string;
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
        defaultMode: 'system' | 'light' | 'dark';
        colors: {
            primary: string;
            background: string;
            accent: string;
            terminal: string;
            warning: string;
        };
    };
    navigation: NavItem[];
    category: Record<string, CategoryConfig>;
    bgm: {
        enabled: boolean;
        defaultPlaylist: string[];
    };
    content: {
        autoCover: {
            enabled: boolean;
            path: string;
            total: number;
        };
    };
    ops: {
        bark: {
            enabled: boolean;
            deviceKeyEnv: string;
            iconUrl: string;
        };
    };
}

let cachedConfig: SiteConfig | null = null;

export function getSiteConfig(): SiteConfig {
    if (cachedConfig) return cachedConfig;

    const configPath = path.resolve(process.cwd(), 'src/config/site.config.yaml');
    const raw = fs.readFileSync(configPath, 'utf-8');
    cachedConfig = yaml.load(raw) as SiteConfig;

    return cachedConfig;
}
