import { visit } from 'unist-util-visit';

export function remarkCallout() {
  return (tree) => {
    visit(tree, 'blockquote', (node) => {
      if (node.children.length === 0) return;
      const firstChild = node.children[0];
      if (firstChild.type !== 'paragraph' || firstChild.children.length === 0) return;
      
      const firstTextNode = firstChild.children[0];
      if (firstTextNode.type !== 'text') return;

      const match = firstTextNode.value.match(/^\[!([a-zA-Z]+)\]([+-]?)\s*(.*)/);
      if (!match) return;

      const type = match[1].toLowerCase();
      let fold = match[2];
      const titleText = match[3].trim() || type.charAt(0).toUpperCase() + type.slice(1);

      // Extract the remaining text correctly, removing exactly what was matched
      const matchedString = match[0];
      firstTextNode.value = firstTextNode.value.substring(matchedString.length).trimStart();
      if (!firstTextNode.value && firstChild.children.length === 1) {
        // If the paragraph is now completely empty, remove it
        // Wait, shifting children might be tricky, let's just make it an empty string
      }

      node.data = node.data || {};
      node.data.hName = 'details';
      node.data.hProperties = {
        className: ['callout', `callout-${type}`]
      };

      // User preference: default folded. Even [!note] without fold sign.
      // So only `+` opens it.
      if (fold === '+') {
        node.data.hProperties.open = true;
      }

      // Instead of HTML node, we create an mdast node that maps to summary
      const summaryMdast = {
        type: 'paragraph',
        data: {
          hName: 'summary',
          hProperties: { className: ['callout-title'] }
        },
        children: [
          {
            type: 'text',
            value: titleText
          }
        ]
      };

      // Wrap the content inside a div class="callout-content" so it can be styled easily
      // Actually <details> just expects <summary> then children. 
      // But wrapping remaining children in a div is cleaner for padding.
      // Hast maps standard children directly. By simply pushing them we have <p> inside <details>.
      node.children.unshift(summaryMdast);

      // Clean up empty lines at the beginning of the first content node if necessary
      if (firstTextNode.value === '' && firstChild.children.length === 1 && node.children.length > 2) {
          node.children.splice(1, 1);
      }
    });
  };
}
