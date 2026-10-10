import { z } from 'zod';

/**
 * 主题接口约定版本。与 src/themes/_contract.md 中的版本号保持一致。
 * data-ui 改名 / 删除、--c-* 变量改名 / 删除、装饰位或状态属性语义变化时必须 +1。
 */
export const CONTRACT_VERSION = 2;

export const themeModeSchema = z.enum(['light', 'dark']);

/** <html data-page> 的取值（属于接口约定的状态属性） */
export const THEME_PAGES = ['home', 'archive', 'post', 'playground', '404', 'other'] as const;
export type ThemePage = (typeof THEME_PAGES)[number];

export const themeMetaSchema = z
    .object({
        id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'id 只能包含小写字母、数字和连字符'),
        name: z.string().min(1),
        nameEn: z.string().optional(),
        api: z.number().int().positive(),
        schemes: z.array(themeModeSchema).min(1).max(2),
        extends: z.string().optional(),
        preview: z.string().optional(),
        /**
         * 主题文案：键为可替换文案的 data-ui 锚点（可加 @page 限定页面，如 "page-title@home"），值为纯文本。
         * 允许的锚点见 _contract.md「可替换文案」；未知键由契约校验给出警告，运行时忽略。
         */
        copy: z
            .record(
                z.string().regex(/^[a-z0-9-]+(@[a-z0-9]+)?$/, 'copy 键格式应为 "<data-ui>" 或 "<data-ui>@<page>"'),
                z.string().max(200),
            )
            .optional(),
        meta: z
            .object({
                themeColor: z.string().optional(),
            })
            .default({}),
    })
    .strict();
