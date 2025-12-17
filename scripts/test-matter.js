const matter = require('gray-matter');

const content = `---
math:
  '\\dobs': '\\mathbf{d}_\\text{obs}'
  '\\dpred': '\\mathbf{d}_\\text{pred}\\left( #1 \\right)'
  '\\mref': '\\mathbf{m}_\\text{ref}'
---
`;

const parsed = matter(content);
console.log('Math object:', parsed.data.math);
console.log('Key check:', Object.keys(parsed.data.math));
