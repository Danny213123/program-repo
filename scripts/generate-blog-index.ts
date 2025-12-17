#!/usr/bin/env node
/**
 * Blog Index Generator
 * 
 * Scans the blogs/ folder and generates a JSON index of all blogs.
 * This is similar to how rocm-blogs-sphinx uses Python to scan directories.
 * 
 * Run: node scripts/generate-blog-index.js
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import stripHtml from 'remark-strip-html';
import { fileURLToPath } from 'url';

// @ts-ignore
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
// BLOGS_DIR can be overridden via environment variable, otherwise looks in project root
const BLOGS_DIR = process.env.BLOGS_DIR || path.resolve(__dirname, '../blogs');
const OUTPUT_FILE = path.resolve(__dirname, '../public/blogs-index.json');
const SEARCH_INDEX_FILE = path.resolve(__dirname, '../public/search-index.json');
const CATEGORIES = [
    'artificial-intelligence',
    'ecosystems-and-partners',
    'high-performance-computing',
    'software-tools-optimization'
];

interface BlogMeta {
    slug: string;
    path: string;
    category: string;
    title: string;
    date: string;
    author: string;
    thumbnail: string;
    tags: string[];
    description: string;
    language: string;
    verticals: string[];
}

interface SearchDocument {
    id: string; // slug
    title: string;
    content: string; // plain text
    tags: string[];
    category: string;
    description: string;
}

interface BlogIndex {
    generatedAt: string;
    totalBlogs: number;
    blogs: BlogMeta[];
    featuredBlogs: string[];
}

// Market vertical classification based on tags (from metadata.py)
const VERTICAL_TAG_MAPPING: Record<string, string[]> = {
    'AI': ['LLM', 'GenAI', 'Diffusion Model', 'Reinforcement Learning', 'PyTorch', 'TensorFlow', 'AI/ML', 'Multimodal', 'Fine-Tuning'],
    'HPC': ['HPC', 'System-Tuning', 'OpenMP', 'Performance', 'Profiling', 'Scientific Computing'],
    'Data Science': ['Time Series', 'Linear Algebra', 'Computer Vision', 'Speech', 'Optimization'],
    'Systems': ['Kubernetes', 'Memory', 'Serving', 'Partner Applications', 'Installation'],
    'Developers': ['C++', 'Compiler', 'JAX', 'Developers'],
    'Robotics': ['Robotics']
};

function classifyVerticals(tags: string[]): string[] {
    const verticalScores: Record<string, number> = {};

    for (const tag of tags) {
        const normalizedTag = tag.trim();
        for (const [vertical, verticalTags] of Object.entries(VERTICAL_TAG_MAPPING)) {
            if (verticalTags.some(vt => vt.toLowerCase() === normalizedTag.toLowerCase())) {
                verticalScores[vertical] = (verticalScores[vertical] || 0) + 1;
            }
        }
    }

    // Return all verticals with score > 0, sorted by score descending
    return Object.entries(verticalScores)
        .filter(([_, score]) => score > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([vertical]) => vertical);
}

// Function to strip markdown/html to plain text
async function getPlainText(markdown: string): Promise<string> {
    const file = await remark()
        .use(stripHtml)
        .process(markdown);
    return String(file).replace(/\s+/g, ' ').trim();
}

async function parseBlogMeta(readmePath: string, category: string, slug: string): Promise<{ meta: BlogMeta, searchDoc: SearchDocument } | null> {
    try {
        const content = fs.readFileSync(readmePath, 'utf-8');
        // Use json: true to allow duplicate keys (last one wins)
        const { data, content: markdownBody } = matter(content, {
            engines: {
                yaml: (s) => {
                    return yaml.load(s, { json: true }) as any;
                }
            }
        });

        if (!data.blogpost) return null;

        const description = data.myst?.html_meta?.['description lang=en'] || '';
        const tags = data.tags ? data.tags.split(',').map((t: string) => t.trim()) : [];

        // Get verticals from metadata or classify from tags
        let verticals: string[] = [];
        const metaVertical = data.myst?.html_meta?.['vertical'];
        if (metaVertical) {
            verticals = Array.isArray(metaVertical) ? metaVertical : [metaVertical];
        } else {
            verticals = classifyVerticals(tags);
        }

        const meta: BlogMeta = {
            slug,
            path: `blogs/${category}/${slug}`,
            category,
            title: data.blog_title || slug,
            date: data.date || '',
            author: data.author || 'Unknown',
            thumbnail: data.thumbnail || '',
            tags,
            description,
            language: data.language || 'English',
            verticals
        };

        // Prepare search document (async)
        // Strip markdown helps remove basic syntax, but we might just use the raw body if remark is too slow or if we want simple regex stripping
        // Using remark-strip-html is cleaner.
        const plainText = await getPlainText(markdownBody);

        const searchDoc: SearchDocument = {
            id: slug,
            title: meta.title,
            description: meta.description,
            tags: meta.tags,
            category: meta.category,
            content: plainText
        };

        return { meta, searchDoc };

    } catch (error: any) {
        if (error.reason) {
            console.error(`❌ YAML Error in ${readmePath}: ${error.reason}`);
        } else {
            console.error(`❌ Error parsing ${readmePath}: ${error.message}`);
        }
        return null;
    }
}

function getFeaturedBlogs(): string[] {
    const featuredPath = path.join(BLOGS_DIR, 'featured-blogs.csv');
    try {
        const content = fs.readFileSync(featuredPath, 'utf-8');
        return content.split('\n').map(line => line.trim()).filter(Boolean);
    } catch {
        return [];
    }
}

async function scanBlogs(): Promise<{ blogs: BlogMeta[], searchDocs: SearchDocument[] }> {
    const blogs: BlogMeta[] = [];
    const searchDocs: SearchDocument[] = [];

    for (const category of CATEGORIES) {
        const categoryPath = path.join(BLOGS_DIR, category);

        if (!fs.existsSync(categoryPath)) {
            console.warn(`Category folder not found: ${categoryPath}`);
            continue;
        }

        const items = fs.readdirSync(categoryPath, { withFileTypes: true });

        for (const item of items) {
            if (!item.isDirectory()) continue;
            if (item.name.startsWith('_') || item.name.startsWith('.') || item.name.startsWith('-')) continue;

            const blogFolder = path.join(categoryPath, item.name);
            const readmePath = path.join(blogFolder, 'README.md');

            if (fs.existsSync(readmePath)) {
                const result = await parseBlogMeta(readmePath, category, item.name);
                if (result) {
                    blogs.push(result.meta);
                    searchDocs.push(result.searchDoc);
                }
            }

            // Also scan nested subdirectories
            const nestedItems = fs.readdirSync(blogFolder, { withFileTypes: true });
            for (const nestedItem of nestedItems) {
                if (!nestedItem.isDirectory()) continue;
                if (nestedItem.name.startsWith('_') || nestedItem.name.startsWith('.') || nestedItem.name.startsWith('-')) continue;
                if (nestedItem.name === 'images' || nestedItem.name === 'figures' || nestedItem.name === 'diagrams') continue;

                const nestedReadmePath = path.join(blogFolder, nestedItem.name, 'README.md');
                if (fs.existsSync(nestedReadmePath)) {
                    const nestedSlug = `${item.name}/${nestedItem.name}`;
                    const result = await parseBlogMeta(nestedReadmePath, category, nestedSlug);
                    if (result) {
                        blogs.push(result.meta);
                        searchDocs.push(result.searchDoc);
                    }
                }
            }
        }
    }

    // Sort by date (newest first)
    blogs.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB.getTime() - dateA.getTime();
    });

    return { blogs, searchDocs };
}

async function main() {
    console.log('🔍 Scanning blogs directory...');
    console.log(`   Blogs path: ${BLOGS_DIR}`);

    if (!fs.existsSync(BLOGS_DIR)) {
        console.error(`❌ Blogs directory not found: ${BLOGS_DIR}`);
        console.log('   Make sure the blogs/ folder exists at the root level.');
        process.exit(1);
    }

    const { blogs, searchDocs } = await scanBlogs();
    const featuredBlogs = getFeaturedBlogs();

    const index: BlogIndex = {
        generatedAt: new Date().toISOString(),
        totalBlogs: blogs.length,
        blogs,
        featuredBlogs
    };

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(index, null, 2));
    fs.writeFileSync(SEARCH_INDEX_FILE, JSON.stringify(searchDocs, null, 2));

    console.log(`✅ Generated blog index with ${blogs.length} blogs`);
    console.log(`   Output: ${OUTPUT_FILE}`);
    console.log(`✅ Generated search index with ${searchDocs.length} documents`);
    console.log(`   Output: ${SEARCH_INDEX_FILE}`);

    // Print category breakdown
    const byCategory = blogs.reduce((acc, blog) => {
        acc[blog.category] = (acc[blog.category] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    console.log('\n📊 Blogs by category:');
    for (const [category, count] of Object.entries(byCategory)) {
        console.log(`   ${category}: ${count}`);
    }
}

main();
