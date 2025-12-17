import { config } from '../config';
import type { BlogMeta, BlogFrontmatter, GitHubContent } from '../types/blog';
import matter from 'gray-matter';

const API_BASE = config.githubApiBase;
const RAW_BASE = config.githubRawBase;

// Cache for API responses to avoid rate limiting
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Sample blogs for when API fails (rate limited or network issues)
const SAMPLE_BLOGS: BlogMeta[] = [
    {
        slug: 'vllm',
        path: 'blogs/artificial-intelligence/vllm',
        category: 'artificial-intelligence',
        title: 'Inferencing and serving with vLLM on AMD GPUs',
        date: 'Sep 19 2024',
        author: 'Clint Greene',
        thumbnail: '2024-10-31-inferencing-and-serving-with-vLLM-on-AMD-GPUs.jpeg',
        tags: ['AI/ML', 'LLM', 'Serving'],
        description: 'Learn step-by-step how to leverage vLLM for high-performance inferencing and model serving on AMD GPUs',
        language: 'English',
        verticals: []
    },
    {
        slug: 'flash-attention',
        path: 'blogs/artificial-intelligence/flash-attention',
        category: 'artificial-intelligence',
        title: 'Flash Attention on AMD GPUs',
        date: 'Aug 15 2024',
        author: 'AMD Developer',
        thumbnail: '',
        tags: ['AI/ML', 'Attention', 'Performance'],
        description: 'Learn how to use Flash Attention for faster transformer inference',
        language: 'English',
        verticals: []
    }
];



async function fetchWithCache<T>(url: string): Promise<T> {
    const cached = cache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data as T;
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    cache.set(url, { data, timestamp: Date.now() });
    return data as T;
}

export async function fetchCategoryContents(category: string): Promise<GitHubContent[]> {
    const url = `${API_BASE}/repos/${config.githubRepo}/contents/${config.blogsPath}/${category}?ref=${config.githubBranch}`;
    return fetchWithCache<GitHubContent[]>(url);
}

export async function fetchBlogReadme(category: string, slug: string): Promise<string> {
    const url = `${RAW_BASE}/${config.githubRepo}/${config.githubBranch}/${config.blogsPath}/${category}/${slug}/README.md`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch blog: ${response.status}`);
    }
    return response.text();
}

export async function fetchFeaturedBlogs(): Promise<string[]> {
    const url = `${RAW_BASE}/${config.githubRepo}/${config.githubBranch}/${config.featuredBlogsCsv}`;
    try {
        const response = await fetch(url);
        if (!response.ok) return [];
        const text = await response.text();
        return text.split('\n').map(line => line.trim()).filter(Boolean);
    } catch {
        return [];
    }
}

export function getImageUrl(category: string, slug: string, imagePath: string): string {
    if (imagePath.startsWith('http')) {
        return imagePath;
    }
    // Remove leading ./ if present
    let cleanPath = imagePath.replace(/^\.\//, '');
    return `${RAW_BASE}/${config.githubRepo}/${config.githubBranch}/${config.blogsPath}/${category}/${slug}/${cleanPath}`;
}

/**
 * Get thumbnail URL trying multiple locations:
 * 1. Blog's local images folder: blogs/{category}/{slug}/images/{thumbnail}
 * 2. Common images folder: blogs/images/{thumbnail}
 * 3. Also try alternate extensions (.jpg/.png/.jpeg)
 */
export function getThumbnailUrl(category: string, slug: string, thumbnail: string): string {
    if (!thumbnail) return '';
    if (thumbnail.startsWith('http')) {
        return thumbnail;
    }

    // Remove leading ./ if present
    let cleanPath = thumbnail.replace(/^\.\//, '');

    // If path already includes a folder prefix (like 'images/'), use from blog root
    if (cleanPath.includes('/')) {
        return `${RAW_BASE}/${config.githubRepo}/${config.githubBranch}/${config.blogsPath}/${category}/${slug}/${cleanPath}`;
    }

    // For simple filenames, check common blogs/images folder first (most newer blogs use this)
    // This is where shared thumbnails are stored
    return `${RAW_BASE}/${config.githubRepo}/${config.githubBranch}/${config.blogsPath}/images/${cleanPath}`;
}

/**
 * Get alternate thumbnail URLs to try if main one fails
 */
export function getAlternateThumbnailUrls(category: string, slug: string, thumbnail: string): string[] {
    if (!thumbnail) return [];
    if (thumbnail.startsWith('http')) return [];

    let cleanPath = thumbnail.replace(/^\.\//, '');
    const urls: string[] = [];

    // Get base name and extension
    const lastDot = cleanPath.lastIndexOf('.');
    const baseName = lastDot > 0 ? cleanPath.substring(0, lastDot) : cleanPath;
    const extensions = ['.jpg', '.jpeg', '.png', '.webp'];

    // Try common images folder with different extensions
    for (const ext of extensions) {
        urls.push(`${RAW_BASE}/${config.githubRepo}/${config.githubBranch}/${config.blogsPath}/images/${baseName}${ext}`);
    }

    // Try blog's local images folder
    urls.push(`${RAW_BASE}/${config.githubRepo}/${config.githubBranch}/${config.blogsPath}/${category}/${slug}/images/${cleanPath}`);
    for (const ext of extensions) {
        urls.push(`${RAW_BASE}/${config.githubRepo}/${config.githubBranch}/${config.blogsPath}/${category}/${slug}/images/${baseName}${ext}`);
    }

    return urls;
}

export function parseBlogMeta(rawContent: string, category: string, slug: string): BlogMeta | null {
    try {
        // Handle duplicate fields in YAML frontmatter
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

        const { data } = matter(processedContent);
        const frontmatter = data as BlogFrontmatter;

        if (!frontmatter.blogpost) return null;

        const description = frontmatter.myst?.html_meta?.['description lang=en'] || '';
        const tags = frontmatter.tags ? String(frontmatter.tags).split(',').map(t => t.trim()) : [];

        const thumbnailUrl = frontmatter.thumbnail ? getThumbnailUrl(category, slug, frontmatter.thumbnail) : undefined;
        const thumbnailAltUrls = frontmatter.thumbnail ? getAlternateThumbnailUrls(category, slug, frontmatter.thumbnail) : undefined;

        return {
            slug,
            path: `${config.blogsPath}/${category}/${slug}`,
            category,
            title: frontmatter.blog_title || slug,
            date: frontmatter.date || '',
            author: frontmatter.author || 'Unknown',
            thumbnail: frontmatter.thumbnail || '',
            thumbnailUrl,
            thumbnailAltUrls,
            tags,
            description,
            language: frontmatter.language || 'English',
            verticals: []
        };
    } catch (error) {
        console.error(`Error parsing blog meta for ${slug}:`, error);
        // Return minimal metadata so page can still render
        return {
            slug,
            path: `${config.blogsPath}/${category}/${slug}`,
            category,
            title: slug,
            date: '',
            author: 'Unknown',
            thumbnail: '',
            tags: [],
            description: '',
            language: 'English',
            verticals: []
        };
    }
}

export async function fetchBlogList(category?: string): Promise<BlogMeta[]> {
    const categories = category
        ? [category]
        : config.categories.map(c => c.id);

    const allBlogs: BlogMeta[] = [];
    let hasError = false;

    // NO LIMIT - fetch all blogs
    for (const cat of categories) {
        try {
            const contents = await fetchCategoryContents(cat);
            const blogFolders = contents
                .filter(item => item.type === 'dir' && !item.name.startsWith('_') && !item.name.startsWith('.'));

            // Fetch blogs in parallel for speed
            const blogPromises = blogFolders.map(async (folder) => {
                try {
                    const readme = await fetchBlogReadme(cat, folder.name);
                    return parseBlogMeta(readme, cat, folder.name);
                } catch (error) {
                    console.warn(`Could not fetch ${cat}/${folder.name}:`, error);
                    return null;
                }
            });

            const blogResults = await Promise.all(blogPromises);
            blogResults.forEach(meta => {
                if (meta) allBlogs.push(meta);
            });

        } catch (error) {
            console.warn(`Could not fetch category ${cat}:`, error);
            hasError = true;
        }
    }

    // If no blogs fetched (likely rate limited), return sample data
    if (allBlogs.length === 0 && hasError) {
        console.log('Using sample blog data due to API rate limits');
        const filtered = category
            ? SAMPLE_BLOGS.filter(b => b.category === category)
            : SAMPLE_BLOGS;
        return filtered;
    }

    // Sort by date (newest first)
    return allBlogs.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB.getTime() - dateA.getTime();
    });
}
