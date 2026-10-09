import type { Element, ElementContent, Root } from "hast";
import { SKIP, visit } from "unist-util-visit";

/**
 * 将段落内的单个换行拆分为独立段落，让“一行一段”的写法也能获得段间距。
 * 引用块与列表内保持原样，避免破坏 callout 解析和列表排版；
 * 需要段内换行（诗句、独白）时使用硬换行（行尾两个空格或反斜杠），生成的 <br> 不会被拆分。
 */
export default function rehypeSplitParagraphs() {
    return (tree: Root) => {
        visit(tree, "element", (node, index, parent) => {
            if (node.tagName === "blockquote" || node.tagName === "li") return SKIP;
            if (node.tagName !== "p" || !parent || index === undefined) return;

            const groups = splitByNewline(node.children);
            if (groups.length <= 1) return;

            const paragraphs: Element[] = groups.map((children) => ({
                type: "element",
                tagName: "p",
                properties: { ...node.properties },
                children,
            }));
            parent.children.splice(index, 1, ...paragraphs);
            return [SKIP, index + paragraphs.length];
        });
    };
}

function splitByNewline(children: ElementContent[]): ElementContent[][] {
    const groups: ElementContent[][] = [[]];

    children.forEach((child, i) => {
        if (child.type !== "text" || !child.value.includes("\n")) {
            groups[groups.length - 1].push(child);
            return;
        }

        // 硬换行在 hast 中表现为 <br> 后紧跟一个 "\n" 文本，这个换行属于 <br>，不作为分段依据。
        const prev = children[i - 1];
        const value = prev?.type === "element" && prev.tagName === "br"
            ? child.value.replace(/^\r?\n/, "")
            : child.value;

        value.split(/\r?\n/).forEach((segment, j) => {
            if (j > 0) groups.push([]);
            if (segment) groups[groups.length - 1].push({ type: "text", value: segment });
        });
    });

    return groups.filter((group) =>
        group.some((node) => node.type !== "text" || node.value.trim() !== ""),
    );
}
