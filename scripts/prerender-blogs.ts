#!/usr/bin/env node
/**
 * Blog Pre-Renderer
 * 
 * Pre-renders all blog markdown content to HTML at build time.
 * This eliminates runtime markdown parsing for instant blog loading.
 * 
 * Run: npm run prerender-blogs
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeHighlight from 'rehype-highlight';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BLOGS_DIR = process.env.BLOGS_DIR || path.resolve(__dirname, '../blogs');
const OUTPUT_FILE = path.resolve(__dirname, '../public/blogs-prerendered.json');

const CATEGORIES = [
    'artificial-intelligence',
    'ecosystems-and-partners',
    'high-performance-computing',
    'software-tools-optimization'
];

interface PrerenderedBlog {
    category: string;
    slug: string;
    title: string;
    date: string;
    author: string;
    thumbnail: string;
    tags: string[];
    description: string;
    renderedHtml: string;
    rawContent: string;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Process MyST math syntax
 */
function processMath(content: string): string {
    let result = content;
    let eqCounter = 0;

    // Parse ```{math} blocks
    result = result.replace(/```\{math\}\s*\n([\s\S]*?)```/g, (_, body) => {
        const lines = body.split('\n');
        const options: Record<string, string> = {};
        const mathLines: string[] = [];

        for (const line of lines) {
            const optMatch = line.trim().match(/^:(\w+):\s*(.*)$/);
            if (optMatch) {
                options[optMatch[1]] = optMatch[2];
            } else {
                mathLines.push(line);
            }
        }

        const mathContent = mathLines.join('\n').trim();
        const label = options['label'];

        if (label) {
            eqCounter++;
            return `<div class="equation-block" id="${label}">\\[${mathContent}\\]<span class="equation-number">(${eqCounter})</span></div>`;
        }
        return `<div class="equation-block">\\[${mathContent}\\]</div>`;
    });

    // Parse $$...$$ blocks
    result = result.replace(/\$\$\s*([\s\S]*?)\$\$/g, (_, math) => {
        return `<div class="equation-block">\\[${math.trim()}\\]</div>`;
    });

    // Parse inline $...$
    result = result.replace(/\$([^$\n]+)\$/g, (_, math) => {
        return `\\(${math}\\)`;
    });

    // Parse {math}`...` role
    result = result.replace(/\{math(?:\s+[^}]+)?\}`([^`]+)`/g, (_, math) => {
        return `\\(${math}\\)`;
    });

    return result;
}

/**
 * Process MyST admonitions and directives
 */
function processDirectives(content: string): string {
    let result = content;

    // Process admonitions: :::{note}, :::{warning}, etc.
    const admonitionTypes = ['note', 'warning', 'tip', 'important', 'caution', 'danger', 'hint', 'seealso'];
    for (const type of admonitionTypes) {
        const regex = new RegExp(`:::?\\{${type}\\}\\s*([^\\n]*)\\n([\\s\\S]*?):::?(?=\\n|$)`, 'g');
        result = result.replace(regex, (_, title, body) => {
            const admonitionTitle = title.trim() || type.charAt(0).toUpperCase() + type.slice(1);
            return `<div class="admonition ${type}"><div class="admonition-title">${admonitionTitle}</div>\n\n${body.trim()}\n\n</div>`;
        });
    }

    // Process dropdown
    result = result.replace(/:::?\{dropdown\}\s*([^\n]*)\n([\s\S]*?):::?(?=\n|$)/g, (_, title, body) => {
        const dropdownTitle = title.trim() || 'Details';
        return `<details class="dropdown"><summary>${dropdownTitle}</summary><div class="dropdown-content">\n\n${body.trim()}\n\n</div></details>`;
    });

    // Process code-block directives
    result = result.replace(/```\{code-block\}\s*(\w+)?\s*\n([\s\S]*?)```/g, (_, lang, body) => {
        const language = lang || 'text';
        return `\`\`\`${language}\n${body}\`\`\``;
    });

    // Process figure directives
    result = result.replace(/```\{figure\}\s*(\S+)\s*\n([\s\S]*?)```/g, (_, imagePath, body) => {
        const options: Record<string, string> = {};
        const captionLines: string[] = [];

        for (const line of body.split('\n')) {
            const match = line.trim().match(/^:(\w+):\s*(.*)$/);
            if (match) {
                options[match[1]] = match[2];
            } else if (line.trim()) {
                captionLines.push(line);
            }
        }

        const alt = options['alt'] || captionLines.join(' ').substring(0, 100) || '';
        const width = options['width'] ? ` width="${options['width']}"` : '';
        const caption = captionLines.join('\n').trim();

        return `<figure class="myst-figure"><img src="${imagePath}" alt="${escapeHtml(alt)}"${width} loading="lazy" />${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
    });

    return result;
}

/**
 * Render markdown to HTML
 */
async function renderMarkdown(markdown: string): Promise<string> {
    const file = await remark()
        .use(remarkGfm)
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeHighlight, { detect: true, ignoreMissing: true })
        .use(rehypeStringify, { allowDangerousHtml: true })
        .process(markdown);

    return String(file);
}

/**
 * Pre-render a single blog
 */
async function prerenderBlog(readmePath: string, category: string, slug: string): Promise<PrerenderedBlog | null> {
    try {
        const rawContent = fs.readFileSync(readmePath, 'utf-8');
        const { data, content } = matter(rawContent);

        if (!data.blogpost) return null;

        // Process MyST syntax
        let processedContent = content;
        processedContent = processMath(processedContent);
        processedContent = processDirectives(processedContent);

        // Render to HTML
        const renderedHtml = await renderMarkdown(processedContent);

        const description = data.myst?.html_meta?.['description lang=en'] || '';
        const tags = data.tags ? data.tags.split(',').map((t: string) => t.trim()) : [];

        return {
            category,
            slug,
            title: data.blog_title || slug,
            date: data.date || '',
            author: data.author || 'Unknown',
            thumbnail: data.thumbnail || '',
            tags,
            description,
            renderedHtml,
            rawContent
        };
    } catch (error) {
        console.error(`Error pre-rendering ${category}/${slug}:`, error);
        return null;
    }
}

async function scanAndPrerender(): Promise<PrerenderedBlog[]> {
    const blogs: PrerenderedBlog[] = [];

    for (const category of CATEGORIES) {
        const categoryPath = path.join(BLOGS_DIR, category);

        if (!fs.existsSync(categoryPath)) {
            console.warn(`Category not found: ${categoryPath}`);
            continue;
        }

        const items = fs.readdirSync(categoryPath, { withFileTypes: true });

        for (const item of items) {
            if (!item.isDirectory()) continue;
            if (item.name.startsWith('_') || item.name.startsWith('.') || item.name.startsWith('-')) continue;

            const blogFolder = path.join(categoryPath, item.name);
            const readmePath = path.join(blogFolder, 'README.md');

            if (fs.existsSync(readmePath)) {
                console.log(`Pre-rendering: ${category}/${item.name}`);
                const blog = await prerenderBlog(readmePath, category, item.name);
                if (blog) {
                    blogs.push(blog);
                }
            }
        }
    }

    return blogs;
}

async function main() {
    console.log('🔨 Pre-rendering blogs to HTML...');
    console.log(`   Blogs path: ${BLOGS_DIR}`);

    if (!fs.existsSync(BLOGS_DIR)) {
        console.error(`❌ Blogs directory not found: ${BLOGS_DIR}`);
        process.exit(1);
    }

    const blogs = await scanAndPrerender();

    // Sort by date
    blogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const output = {
        generatedAt: new Date().toISOString(),
        totalBlogs: blogs.length,
        blogs
    };

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output));

    console.log(`✅ Pre-rendered ${blogs.length} blogs`);
    console.log(`   Output: ${OUTPUT_FILE}`);
}

main().catch(console.error);
