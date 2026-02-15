import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { z } from 'zod';

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

const siteConfigSchema = z.object({
    site: z.object({
        title: z.string(),
        subtitle: z.string(),
        url: z.string().url(),
        author: z.string(),
        logoText: z.string(),
        timezone: z.string(),
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
    category: z.record(categoryConfigSchema),
    bgm: z.object({
        enabled: z.boolean(),
        defaultPlaylist: z.array(z.string()),
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

/**
 * 模块级缓存：默认复用内存配置；当文件 mtime 变化时自动失效重载
 */
const configPath = path.resolve(process.cwd(), 'src/config/site.config.yaml');
let cachedConfig: SiteConfig | null = null;
let cachedConfigMtime = -1;

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
    const currentMtime = fs.statSync(configPath).mtimeMs;
    if (!cachedConfig || currentMtime !== cachedConfigMtime) {
        cachedConfig = loadSiteConfig();
        cachedConfigMtime = currentMtime;
    }
    return cachedConfig;
}
