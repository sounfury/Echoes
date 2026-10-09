import { z } from 'zod';

/**
 * 主题接口约定版本。与 src/themes/_contract.md 中的版本号保持一致。
 * data-ui 改名 / 删除、--c-* 变量改名 / 删除、装饰位或状态属性语义变化时必须 +1。
 */
export const CONTRACT_VERSION = 1;

export const themeModeSchema = z.enum(['light', 'dark']);

export const themeMetaSchema = z
    .object({
        id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'id 只能包含小写字母、数字和连字符'),
        name: z.string().min(1),
        nameEn: z.string().optional(),
        api: z.number().int().positive(),
        schemes: z.array(themeModeSchema).min(1).max(2),
        extends: z.string().optional(),
        preview: z.string().optional(),
        meta: z
            .object({
                themeColor: z.string().optional(),
            })
            .default({}),
    })
    .strict();
