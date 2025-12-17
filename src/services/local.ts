// Local Blog Service - no external imports needed
import type { BlogMeta, BlogPost, BlogFrontmatter } from '../types/blog';
import matter from 'gray-matter';
import { config } from '../config';

/**
 * Local Blog Service
 * 
 * Reads blogs from local files instead of GitHub API.
 * Requires running `npm run generate-index` first to create blogs-index.json
 */

interface BlogIndex {
    generatedAt: string;
    totalBlogs: number;
    blogs: BlogMeta[];
    featuredBlogs: string[];
}

// Cache for the blog index
let cachedIndex: BlogIndex | null = null;

/**
 * Load the blog index from public/blogs-index.json
 */
async function loadBlogIndex(): Promise<BlogIndex> {
    if (cachedIndex) return cachedIndex;

    try {
        const response = await fetch('/blogs-index.json');
        if (!response.ok) {
            throw new Error(`Failed to load blog index: ${response.status}`);
        }
        cachedIndex = await response.json();
        return cachedIndex!;
    } catch (error) {
        console.error('Error loading blog index:', error);
        console.log('Make sure to run: npm run generate-index');
        throw error;
    }
}

/**
 * Get thumbnail URL for a blog
 */
export function getThumbnailUrl(category: string, slug: string, thumbnail: string): string {
    if (!thumbnail) return '';
    if (thumbnail.startsWith('http')) return thumbnail;

    // Remove leading ./ if present
    const cleanPath = thumbnail.replace(/^\.\//, '');

    // Use local bundled content when available
    if (config.useLocalContent) {
        // Content is bundled at /blogs/ in the build
        const baseUrl = `/blogs/${category}/${slug}/`;
        if (cleanPath.includes('/')) {
            return `${baseUrl}${cleanPath}`;
        }
        return `${baseUrl}images/${cleanPath}`;
    }

    // Fallback: use GitHub raw URLs
    const isDev = import.meta.env.DEV;
    const gitHubBase = `https://raw.githubusercontent.com/${config.githubRepo}/${config.githubBranch}`;
    const baseUrl = isDev
        ? `/blogs/${category}/${slug}/`
        : `${gitHubBase}/blogs/${category}/${slug}/`;

    if (cleanPath.includes('/')) {
        return `${baseUrl}${cleanPath}`;
    }
    return `${baseUrl}images/${cleanPath}`;
}

/**
 * Get alternate thumbnail URLs to try
 */
export function getAlternateThumbnailUrls(category: string, slug: string, thumbnail: string): string[] {
    if (!thumbnail) return [];
    if (thumbnail.startsWith('http')) return [];

    const cleanPath = thumbnail.replace(/^\.\//, '');
    const urls: string[] = [];

    const lastDot = cleanPath.lastIndexOf('.');
    const baseName = lastDot > 0 ? cleanPath.substring(0, lastDot) : cleanPath;
    const extensions = ['.jpg', '.jpeg', '.png', '.webp'];

    // In production, use GitHub raw URLs
    const isDev = import.meta.env.DEV;
    const gitHubBase = 'https://raw.githubusercontent.com/ROCm/rocm-blogs/release';
    const baseUrl = isDev
        ? `/blogs/${category}/${slug}/`
        : `${gitHubBase}/blogs/${category}/${slug}/`;
    const sharedBaseUrl = isDev
        ? `/blogs/images/`
        : `${gitHubBase}/blogs/images/`;

    // If path includes folder, the main URL handles it; try common images folder as fallback
    if (cleanPath.includes('/')) {
        // Try common images folder with the filename only
        const filename = cleanPath.split('/').pop() || cleanPath;
        const filenameBaseName = filename.lastIndexOf('.') > 0
            ? filename.substring(0, filename.lastIndexOf('.'))
            : filename;

        urls.push(`${sharedBaseUrl}${filename}`);
        for (const ext of extensions) {
            urls.push(`${sharedBaseUrl}${filenameBaseName}${ext}`);
        }
    } else {
        // For simple filenames, main URL tries local images folder
        // Fallback to common blogs/images folder
        urls.push(`${sharedBaseUrl}${cleanPath}`);
        for (const ext of extensions) {
            urls.push(`${sharedBaseUrl}${baseName}${ext}`);
        }

        // Also try different extensions in local images folder
        for (const ext of extensions) {
            urls.push(`${baseUrl}images/${baseName}${ext}`);
        }
    }

    return urls;
}

/**
 * Fetch list of blogs from the local index
 */
export async function fetchBlogList(category?: string): Promise<BlogMeta[]> {
    const index = await loadBlogIndex();

    let blogs = index.blogs.map(blog => ({
        ...blog,
        thumbnailUrl: blog.thumbnail ? getThumbnailUrl(blog.category, blog.slug, blog.thumbnail) : undefined,
        thumbnailAltUrls: blog.thumbnail ? getAlternateThumbnailUrls(blog.category, blog.slug, blog.thumbnail) : undefined
    }));

    if (category) {
        blogs = blogs.filter(b => b.category === category);
    }

    return blogs;
}

/**
 * Fetch featured blog titles
 */
export async function fetchFeaturedBlogs(): Promise<string[]> {
    const index = await loadBlogIndex();
    return index.featuredBlogs;
}

/**
 * Fetch full blog content
 * Uses pre-loaded content from blog index for instant loading
 */
export async function fetchBlogContent(category: string, slug: string): Promise<BlogPost> {
    // First, try to get pre-loaded content from the blog index (instant!)
    const index = await loadBlogIndex();
    const blogMeta = index.blogs.find(b => b.category === category && b.slug === slug);

    let rawContent: string;

    if (blogMeta?.rawContent) {
        // Content is pre-loaded in the index - instant!
        rawContent = blogMeta.rawContent;
    } else {
        // Fallback: fetch from network
        let readmePath: string;
        if (config.useLocalContent) {
            readmePath = `/blogs/${category}/${slug}/README.md`;
        } else {
            const isDev = import.meta.env.DEV;
            readmePath = isDev
                ? `/blogs/${category}/${slug}/README.md`
                : `https://raw.githubusercontent.com/${config.githubRepo}/${config.githubBranch}/blogs/${category}/${slug}/README.md`;
        }

        // Try cache first
        let response: Response | undefined;
        try {
            const cache = await caches.open('blog-content-v1');
            response = await cache.match(readmePath);
        } catch (e) {
            console.warn('Cache access failed:', e);
        }

        if (!response) {
            response = await fetch(readmePath);
        }

        if (!response.ok) {
            throw new Error(`Failed to load blog: ${response.status}`);
        }

        rawContent = await response.text();
    }

    // Handle duplicate fields in YAML frontmatter (gray-matter throws on these)
    let processedContent = rawContent;
    const frontmatterMatch = rawContent.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
        const yamlContent = frontmatterMatch[1];
        const seenKeys = new Set<string>();
        const deduplicatedLines: string[] = [];

        for (const line of yamlContent.split('\n')) {
            const keyMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):/);
            if (keyMatch) {
                const key = keyMatch[1];
                if (seenKeys.has(key)) {
                    console.warn(`Duplicate frontmatter key "${key}" in ${category}/${slug}, skipping`);
                    continue;
                }
                seenKeys.add(key);
            }
            deduplicatedLines.push(line);
        }

        processedContent = `---\n${deduplicatedLines.join('\n')}\n---${rawContent.slice(frontmatterMatch[0].length)}`;
    }

    let data: Record<string, any> = {};
    let content = processedContent;

    try {
        const parsed = matter(processedContent);
        data = parsed.data;
        content = parsed.content;
    } catch (parseError) {
        console.warn(`Frontmatter parsing error for ${category}/${slug}, using raw content:`, parseError);
        const stripped = processedContent.replace(/^---[\s\S]*?---\n?/, '');
        content = stripped;
    }

    const frontmatter = data as BlogFrontmatter;

    const description = frontmatter.myst?.html_meta?.['description lang=en'] || '';
    const tags = frontmatter.tags ? String(frontmatter.tags).split(',').map(t => t.trim()) : [];

    return {
        slug,
        path: `blogs/${category}/${slug}`,
        category,
        title: frontmatter.blog_title || slug,
        date: frontmatter.date || '',
        author: frontmatter.author || 'Unknown',
        thumbnail: frontmatter.thumbnail || '',
        thumbnailUrl: frontmatter.thumbnail ? getThumbnailUrl(category, slug, frontmatter.thumbnail) : undefined,
        thumbnailAltUrls: frontmatter.thumbnail ? getAlternateThumbnailUrls(category, slug, frontmatter.thumbnail) : undefined,
        tags,
        description,
        language: frontmatter.language || 'English',
        verticals: blogMeta?.verticals || [],
        content,
        rawContent: processedContent
    };
}

/**
 * Get image URL for inline blog images
 */
export function getImageUrl(category: string, slug: string, imagePath: string): string {
    if (imagePath.startsWith('http')) return imagePath;

    // Remove leading ./ if present
    const cleanPath = imagePath.replace(/^\.\//, '');
    return `/blogs/${category}/${slug}/${cleanPath}`;
}

// Cache for MyST config and slug mapping (improves performance for slower systems)
let mystConfig: any = null;
let mystSlugMap: Map<string, string> | null = null;

/**
 * Initialize MyST config cache and build slug-to-json mapping
 */
async function getMystConfig(): Promise<{ config: any; slugMap: Map<string, string> }> {
    if (mystConfig && mystSlugMap) {
        return { config: mystConfig, slugMap: mystSlugMap };
    }

    try {
        const response = await fetch('/_build/site/config.json');
        if (!response.ok) throw new Error('Config not found');

        mystConfig = await response.json();
        mystSlugMap = new Map();

        // Build slug→location map from pages array
        if (mystConfig.projects?.[0]?.pages) {
            for (const page of mystConfig.projects[0].pages) {
                if (page.slug && page.title) {
                    // Pages don't have location directly, but we can use slug to fetch content
                    mystSlugMap.set(page.slug, page.slug);
                }
            }
        }

        return { config: mystConfig, slugMap: mystSlugMap };
    } catch {
        return { config: null, slugMap: new Map() };
    }
}

/**
 * Fetch pre-built MyST JSON content from the _build/site/content directory
 * Uses cached config.json for faster lookups on slower systems
 */
export async function fetchMystBuiltContent(category: string, slug: string): Promise<string | null> {
    try {
        const { slugMap } = await getMystConfig();

        // 1. Try exact slug match from config map
        // The config map keys are the slugs defined in myst.yml (or auto-generated)
        // If we find the slug, the file should be at content/{slug}.json
        if (slugMap && slugMap.has(slug)) {
            try {
                const response = await fetch(`/_build/site/content/${slug}.json`);
                if (response.ok) {
                    const data = await response.json();
                    return extractMystHtml(data);
                }
            } catch {
                // Continue to fallbacks
            }
        }

        // 2. Try constructing paths directly (O(1) guesses instead of O(N) search)
        // MyST often names files as {slug}.json or {category}-{slug}.json
        const directPaths = [
            `/_build/site/content/${slug}.json`,
            `/_build/site/content/${category}-${slug}.json`,
            // Sometimes it might use the full path convention
            `/_build/site/content/blogs-${category}-${slug}.json`
        ];

        for (const path of directPaths) {
            try {
                const response = await fetch(path);
                if (response.ok) {
                    const data = await response.json();
                    return extractMystHtml(data);
                }
            } catch {
                // Try next
            }
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Extract HTML from MyST JSON output
 * MyST JSON contains mdast tree with pre-rendered KaTeX HTML for math
 */
function extractMystHtml(mystData: any): string {
    // MyST uses mdast field for the AST
    if (mystData.kind === 'Article' && mystData.mdast) {
        const mdast = mystData.mdast;
        if (mdast.type === 'root' && mdast.children) {
            return `<div class="myst-content">${mdast.children.map((node: any) => nodeToHtml(node, mystData)).join('')}</div>`;
        }
    }
    return '';
}

function nodeToHtml(node: any, rootData?: any): string {
    if (!node) return '';

    switch (node.type) {
        case 'block':
            return node.children?.map((n: any) => nodeToHtml(n, rootData)).join('') || '';

        case 'paragraph':
            return `<p>${node.children?.map((n: any) => nodeToHtml(n, rootData)).join('') || ''}</p>`;

        case 'text':
            return escapeHtml(node.value || '');

        case 'heading': {
            const level = node.depth || 1;
            const id = node.html_id || node.identifier || '';
            return `<h${level}${id ? ` id="${id}"` : ''}>${node.children?.map((n: any) => nodeToHtml(n, rootData)).join('') || ''}</h${level}>`;
        }

        case 'math':
            // MyST pre-renders KaTeX HTML
            if (node.html) {
                return `<div class="math-block">${node.html}</div>`;
            }
            return `<div class="math-block">$$${escapeHtml(node.value || '')}$$</div>`;

        case 'inlineMath':
            // MyST pre-renders KaTeX HTML
            if (node.html) {
                return node.html;
            }
            return `$${escapeHtml(node.value || '')}$`;

        case 'code':
            return `<pre><code class="language-${node.lang || 'text'}">${escapeHtml(node.value || '')}</code></pre>`;

        case 'inlineCode':
            return `<code>${escapeHtml(node.value || '')}</code>`;

        case 'list': {
            const tag = node.ordered ? 'ol' : 'ul';
            const start = node.start && node.start !== 1 ? ` start="${node.start}"` : '';
            return `<${tag}${start}>${node.children?.map((n: any) => nodeToHtml(n, rootData)).join('') || ''}</${tag}>`;
        }

        case 'listItem':
            return `<li>${node.children?.map((n: any) => nodeToHtml(n, rootData)).join('') || ''}</li>`;

        case 'table':
            return `<table>${node.children?.map((n: any) => nodeToHtml(n, rootData)).join('') || ''}</table>`;

        case 'tableRow':
            return `<tr>${node.children?.map((n: any) => nodeToHtml(n, rootData)).join('') || ''}</tr>`;

        case 'tableCell': {
            const tag = node.header ? 'th' : 'td';
            return `<${tag}>${node.children?.map((n: any) => nodeToHtml(n, rootData)).join('') || ''}</${tag}>`;
        }

        case 'link':
            return `<a href="${node.url || ''}"${node.url?.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${node.children?.map((n: any) => nodeToHtml(n, rootData)).join('') || ''}</a>`;

        case 'image': {
            const width = node.width ? ` width="${node.width}"` : '';
            const height = node.height ? ` height="${node.height}"` : '';
            return `<img src="${node.url || ''}"${width}${height} alt="" loading="lazy" />`;
        }

        case 'emphasis':
            return `<em>${node.children?.map((n: any) => nodeToHtml(n, rootData)).join('') || ''}</em>`;

        case 'strong':
            return `<strong>${node.children?.map((n: any) => nodeToHtml(n, rootData)).join('') || ''}</strong>`;

        case 'span':
            return node.children?.map((n: any) => nodeToHtml(n, rootData)).join('') || '';

        case 'thematicBreak':
            return '<hr />';

        case 'blockquote':
            return `<blockquote>${node.children?.map((n: any) => nodeToHtml(n, rootData)).join('') || ''}</blockquote>`;

        case 'footnoteReference':
            return `<sup><a href="#fn-${node.identifier}">[${node.enumerator || node.identifier}]</a></sup>`;

        case 'footnoteDefinition':
            return `<div class="footnote" id="fn-${node.identifier}"><sup>${node.enumerator || node.identifier}</sup> ${node.children?.map((n: any) => nodeToHtml(n, rootData)).join('') || ''}</div>`;

        // Admonitions and directives
        case 'admonition':
        case 'callout':
        case 'aside': {
            const kind = node.kind || node.name || 'note';
            const title = node.title || kind.charAt(0).toUpperCase() + kind.slice(1);
            return `<div class="admonition ${kind}"><div class="admonition-title">${escapeHtml(title)}</div>${node.children?.map((n: any) => nodeToHtml(n, rootData)).join('') || ''}</div>`;
        }

        case 'mystDirective':
        case 'container': {
            const name = node.name || 'container';
            if (['note', 'warning', 'tip', 'caution', 'important', 'danger', 'hint', 'seealso'].includes(name)) {
                const title = node.args || node.title || name.charAt(0).toUpperCase() + name.slice(1);
                return `<div class="admonition ${name}"><div class="admonition-title">${escapeHtml(title)}</div>${node.children?.map((n: any) => nodeToHtml(n, rootData)).join('') || ''}</div>`;
            }
            // Handle dropdown
            if (name === 'dropdown') {
                const title = node.args || node.title || 'Details';
                const isOpen = node.open ? ' open' : '';
                const content = node.children?.map((n: any) => nodeToHtml(n, rootData)).join('') || '';
                return `<details class="dropdown"${isOpen}><summary>${escapeHtml(title)}</summary><div class="dropdown-content">${content}</div></details>`;
            }
            // Handle card
            if (name === 'card') {
                const title = node.args || node.title || '';
                const link = node.link || '';
                const header = node.header || '';
                const footer = node.footer || '';
                const content = node.children?.map((n: any) => nodeToHtml(n, rootData)).join('') || '';

                let cardHtml = link ? `<a href="${escapeHtml(link)}" class="card" target="_blank" rel="noopener">` : '<div class="card">';
                if (header) cardHtml += `<div class="card-header">${escapeHtml(header)}</div>`;
                else if (title) cardHtml += `<div class="card-header">${escapeHtml(title)}</div>`;
                cardHtml += `<div class="card-body">${content}</div>`;
                if (footer) cardHtml += `<div class="card-footer">${escapeHtml(footer)}</div>`;
                cardHtml += link ? '</a>' : '</div>';
                return cardHtml;
            }
            // Handle grid
            if (name === 'grid') {
                const cols = node.columns || '3';
                const content = node.children?.map((n: any) => nodeToHtml(n, rootData)).join('') || '';
                return `<div class="grid" data-columns="${cols}">${content}</div>`;
            }
            // Handle tab-set
            if (name === 'tab-set' || name === 'tabSet') {
                const tabs = node.children || [];
                let tabLabels = '<div class="tab-set-tabs">';
                let tabContents = '';
                tabs.forEach((tab: any, index: number) => {
                    const isActive = index === 0 ? ' class="active"' : '';
                    const tabTitle = tab.title || tab.args || `Tab ${index + 1}`;
                    tabLabels += `<button${isActive} data-tab="${index}">${escapeHtml(tabTitle)}</button>`;
                    const display = index === 0 ? '' : ' style="display:none"';
                    tabContents += `<div class="tab-content" data-tab="${index}"${display}>${tab.children?.map((n: any) => nodeToHtml(n, rootData)).join('') || ''}</div>`;
                });
                tabLabels += '</div>';
                return `<div class="tab-set">${tabLabels}<div class="tab-set-content">${tabContents}</div></div>`;
            }
            // Handle tab-item (individual tab within tab-set)
            if (name === 'tab-item' || name === 'tabItem') {
                // This is handled by tab-set parent, but just in case it's standalone
                const title = node.args || node.title || 'Tab';
                return `<div class="tab-item"><div class="tab-item-title">${escapeHtml(title)}</div>${node.children?.map((n: any) => nodeToHtml(n, rootData)).join('') || ''}</div>`;
            }
            // Handle button role
            if (name === 'button') {
                const text = node.args || 'Button';
                const link = node.link || '#';
                return `<a href="${escapeHtml(link)}" class="btn" role="button">${escapeHtml(text)}</a>`;
            }
            // Generic container
            return `<div class="myst-${name}">${node.children?.map((n: any) => nodeToHtml(n, rootData)).join('') || ''}</div>`;
        }

        case 'figure': {
            const caption = node.caption || '';
            const alignClass = node.align ? ` align-${node.align}` : '';
            return `<figure class="myst-figure${alignClass}">
                ${node.children?.map((n: any) => nodeToHtml(n, rootData)).join('') || ''}
                <div class="zoom-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        <line x1="11" y1="8" x2="11" y2="14"></line>
                        <line x1="8" y1="11" x2="14" y2="11"></line>
                    </svg>
                </div>
                ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}
            </figure>`;
        }

        default:
            if (node.children) {
                return node.children.map((n: any) => nodeToHtml(n, rootData)).join('');
            }
            return '';
    }
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

