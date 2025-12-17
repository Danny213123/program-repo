import React, { useEffect, useState, useRef, memo } from 'react';
import { Link } from 'react-router-dom';
import type { BlogPost as BlogPostType, BlogMeta } from '../types/blog';
import { fetchBlogContent, fetchMystBuiltContent, fetchBlogList } from '../services/local';
import { formatDate, getCategoryDisplayName, renderMarkdownContent, textSimilarity, rewriteImageUrlsForProduction } from '../utils/markdown';
import './BlogPost.css';
import '../styles/myst-content.css';
import genericImage from '../assets/generic.jpg';

interface BlogPostProps {
    category: string;
    slug: string;
}


// Memoized content component to prevent re-renders wiping MathJax DOM
const BlogContent = memo(({ html, onRef, onClick }: {
    html: string,
    onRef: React.RefObject<HTMLDivElement | null>,
    onClick: (e: React.MouseEvent) => void
}) => {
    return (
        <div
            className="blog-post-content myst-content"
            ref={onRef}
            dangerouslySetInnerHTML={{ __html: html }}
            onClick={onClick}
        />
    );
}, (prev, next) => prev.html === next.html);

export function BlogPost({ category, slug }: BlogPostProps) {
    const [post, setPost] = useState<BlogPostType | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [toc, setToc] = useState<{ id: string, text: string, level: number }[]>([]);
    const [activeId, setActiveId] = useState<string>('');
    const [relatedPosts, setRelatedPosts] = useState<BlogMeta[]>([]);
    const contentRef = useRef<HTMLDivElement>(null);

    // Initial load
    useEffect(() => {
        async function loadPost() {
            try {
                setLoading(true);
                setError(null);

                const blogPost = await fetchBlogContent(category, slug);

                // Check if content is already pre-rendered HTML (starts with HTML tag)
                const isPrerendered = blogPost.content &&
                    (blogPost.content.trim().startsWith('<') || blogPost.content.includes('</'));

                if (!isPrerendered) {
                    // Content is raw markdown - need to render it
                    const mystHtmlContent = await fetchMystBuiltContent(category, slug);

                    if (mystHtmlContent) {
                        blogPost.content = rewriteImageUrlsForProduction(mystHtmlContent);
                    } else {
                        const rendered = await renderMarkdownContent(blogPost.rawContent, category, slug);
                        blogPost.content = rewriteImageUrlsForProduction(rendered);
                    }
                } else {
                    // Content is pre-rendered - just rewrite image URLs
                    blogPost.content = rewriteImageUrlsForProduction(blogPost.content);
                }

                // Remove duplicate H1 title from content if present (since we render it in the header)
                // Use a function to only replace the FIRST occurrence
                let h1Removed = false;
                blogPost.content = blogPost.content.replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, (match) => {
                    if (!h1Removed) {
                        h1Removed = true;
                        return ''; // Remove the first H1
                    }
                    return match; // Keep subsequent H1s (if any)
                });

                setPost(blogPost);

                // Fetch related posts using cosine similarity
                const allPosts = await fetchBlogList(); // Get ALL posts
                const currentContent = blogPost.title + ' ' + (blogPost.description || '') + ' ' + (blogPost.rawContent || '');

                // Calculate similarity for each post and sort by score
                const postsWithSimilarity = allPosts
                    .filter(p => p.slug !== slug) // Exclude current post
                    .map(p => ({
                        post: p,
                        similarity: textSimilarity(
                            currentContent,
                            p.title + ' ' + (p.description || '') + ' ' + (p.tags?.join(' ') || '')
                        )
                    }))
                    .sort((a, b) => b.similarity - a.similarity)
                    .slice(0, 3); // Top 3 most similar

                setRelatedPosts(postsWithSimilarity.map(p => p.post));
            } catch (err: any) {
                console.error('Error loading blog post:', err);
                setError(err.message || 'Failed to load blog post');
            } finally {
                setLoading(false);
            }
        }

        loadPost();
    }, [category, slug]);

    // Build Table of Contents and initialize features
    useEffect(() => {
        if (!loading && post && contentRef.current) {
            const headers = Array.from(contentRef.current.querySelectorAll('h2, h3'));
            const usedIds = new Map<string, number>(); // Track used IDs to handle duplicates

            const tocItems = headers.map((header, index) => {
                if (!header.id) {
                    // Generate slug from heading text
                    const text = header.textContent || '';
                    let slug = text.toLowerCase()
                        .replace(/[^\w\s-]/g, '') // Remove special chars
                        .replace(/\s+/g, '-')     // Spaces to hyphens
                        .replace(/-+/g, '-')      // Collapse multiple hyphens
                        .trim() || `section-${index}`;

                    // Handle duplicate slugs by appending a counter
                    const count = usedIds.get(slug) || 0;
                    if (count > 0) {
                        slug = `${slug}-${count + 1}`;
                    }
                    usedIds.set(slug.replace(/-\d+$/, ''), count + 1); // Track base slug

                    header.id = slug;
                }
                return {
                    id: header.id,
                    text: header.textContent || '',
                    level: parseInt(header.tagName.substring(1))
                };
            });
            setToc(tocItems);

            // Initialize Mermaid
            const initMermaid = async () => {
                const mermaidElements = contentRef.current?.querySelectorAll('pre.mermaid');
                if (!mermaidElements || mermaidElements.length === 0) return;

                if (!(window as any).mermaid) {
                    await new Promise<void>((resolve) => {
                        const script = document.createElement('script');
                        script.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
                        script.async = true;
                        script.onload = () => resolve();
                        document.head.appendChild(script);

                        script.onload = () => resolve();
                        document.head.appendChild(script);
                    });
                }

                (window as any).mermaid.initialize({
                    startOnLoad: false,
                    theme: 'dark',
                    securityLevel: 'loose',
                    flowchart: { useMaxWidth: true, htmlLabels: true }
                });

                for (let i = 0; i < mermaidElements.length; i++) {
                    const el = mermaidElements[i] as HTMLElement;
                    const base64Code = el.getAttribute('data-code') || '';
                    const code = base64Code ? atob(base64Code) : (el.textContent || '');
                    const id = `mermaid-${Date.now()}-${i}`;

                    try {
                        const { svg } = await (window as any).mermaid.render(id, code);
                        el.innerHTML = svg;
                        el.classList.add('mermaid-rendered');
                    } catch (error) {
                        console.error('[Mermaid] Render error:', error);
                        el.innerHTML = `<div class="mermaid-error">Mermaid diagram error</div>`;
                    }
                }
            };
            initMermaid();

            // Initialize KaTeX for Math
            const initMath = async () => {
                const hasMath = contentRef.current?.querySelector('.equation-block') ||
                    (contentRef.current?.textContent && (
                        contentRef.current.textContent.includes('\\[') ||
                        contentRef.current.textContent.includes('\\(')
                    ));

                if (!hasMath) return;

                if (!(window as any).renderMathInElement) {
                    await new Promise<void>((resolve) => {
                        const script = document.createElement('script');
                        script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js';
                        script.crossOrigin = "anonymous";
                        script.async = true;

                        script.onload = () => {
                            const autoRenderScript = document.createElement('script');
                            autoRenderScript.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js';
                            autoRenderScript.crossOrigin = "anonymous";
                            autoRenderScript.async = true;
                            autoRenderScript.onload = () => resolve();
                            document.head.appendChild(autoRenderScript);
                        };
                        document.head.appendChild(script);
                    });
                }

                if ((window as any).renderMathInElement && contentRef.current) {
                    (window as any).renderMathInElement(contentRef.current, {
                        delimiters: [
                            { left: '$$', right: '$$', display: true },
                            { left: '\\[', right: '\\]', display: true },
                            { left: '\\(', right: '\\)', display: false },
                            { left: '$', right: '$', display: false }
                        ],
                        throwOnError: false
                    });
                }
            };
            initMath();

            // Initialize Prism for Syntax Highlighting
            const initPrism = async () => {
                if (!(window as any).Prism) {
                    await new Promise<void>((resolve) => {
                        const script = document.createElement('script');
                        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js';
                        script.async = true;
                        script.onload = () => {
                            const lnScript = document.createElement('script');
                            lnScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/line-numbers/prism-line-numbers.min.js';
                            lnScript.onload = () => resolve();
                            document.head.appendChild(lnScript);

                            const alScript = document.createElement('script');
                            alScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js';
                            document.head.appendChild(alScript);
                        };
                        document.head.appendChild(script);
                    });
                }

                setTimeout(() => {
                    if (!contentRef.current) return;

                    // Add line-numbers class to ALL pre elements
                    const allPreElements = contentRef.current.querySelectorAll('pre');
                    allPreElements.forEach(pre => {
                        pre.classList.add('line-numbers');

                        // Add Copy Button if not present
                        if (!pre.querySelector('.copy-button')) {
                            const copyBtn = document.createElement('button');
                            copyBtn.className = 'copy-button';
                            copyBtn.textContent = 'Copy';
                            copyBtn.onclick = () => {
                                const code = pre.querySelector('code')?.textContent || '';
                                navigator.clipboard.writeText(code).then(() => {
                                    copyBtn.textContent = 'Copied!';
                                    setTimeout(() => copyBtn.textContent = 'Copy', 2000);
                                });
                            };
                            pre.appendChild(copyBtn);
                        }
                    });

                    // Handle data-start for containers
                    const codeContainers = contentRef.current.querySelectorAll('.code-block-container[data-start]');
                    codeContainers.forEach(container => {
                        const pre = container.querySelector('pre');
                        const startLine = container.getAttribute('data-start');
                        if (pre && startLine) {
                            pre.setAttribute('data-start', startLine);
                        }
                    });

                    if ((window as any).Prism) {
                        (window as any).Prism.highlightAllUnder(contentRef.current);
                    }
                }, 300);
            };

            initPrism();

            // Setup ScrollSpy
            const observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            setActiveId(entry.target.id);
                        }
                    });
                },
                { rootMargin: '-100px 0px -66%' }
            );

            headers.forEach(header => observer.observe(header));
            return () => observer.disconnect();
        }
    }, [loading, post]);

    // Handle URL hash navigation on load
    useEffect(() => {
        if (!loading && post && contentRef.current) {
            const hash = window.location.hash;
            if (hash) {
                const id = hash.substring(1);
                // Small delay to ensure content is fully rendered
                setTimeout(() => {
                    const el = document.getElementById(id);
                    if (el) {
                        const offset = 80;
                        const elementPosition = el.getBoundingClientRect().top;
                        const offsetPosition = elementPosition + window.pageYOffset - offset;
                        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                        setActiveId(id);
                    }
                }, 100);
            }
        }
    }, [loading, post]);

    // Handle Share
    const handleShare = (platform: 'copy' | 'twitter' | 'linkedin' | 'email') => {
        const url = window.location.href;
        const title = post?.title || '';

        switch (platform) {
            case 'copy':
                navigator.clipboard.writeText(url);
                const btn = document.getElementById('share-copy-btn');
                if (btn) {
                    const original = btn.innerHTML;
                    btn.innerHTML = '✓';
                    setTimeout(() => btn.innerHTML = original, 2000);
                }
                break;
            case 'twitter':
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`, '_blank');
                break;
            case 'linkedin':
                window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
                break;
            case 'email':
                window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`;
                break;
        }
    };

    // Image click handler
    useEffect(() => {
        if (!contentRef.current) return;

        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'IMG' && target.closest('.myst-content')) {
                const img = target as HTMLImageElement;
                if (!img.classList.contains('no-zoom')) {
                    setSelectedImage(img.src);
                }
            }
        };

        const contentDiv = contentRef.current;
        contentDiv.addEventListener('click', handleClick);
        return () => contentDiv.removeEventListener('click', handleClick);
    }, [loading, post]);

    if (loading) {
        return (
            <div className="blog-post-loading">
                <div className="loading-spinner"></div>
                <p>Loading post...</p>
            </div>
        );
    }

    if (error || !post) {
        return (
            <div className="blog-post-error">
                <h2>Post not found</h2>
                <p>{error || "The requested blog post doesn't exist."}</p>
                <Link to="/" className="back-link">← Back to Blog</Link>
            </div>
        );
    }

    const wordCount = post.rawContent?.split(/\s+/).length || 0;
    const readTime = Math.ceil(wordCount / 200);

    return (
        <div className="blog-post">
            {/* Fixed Social Sidebar */}
            <aside className="social-sidebar">
                <button className="social-btn linkedin" onClick={() => handleShare('linkedin')} title="Share on LinkedIn">
                    <svg fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" /></svg>
                </button>
                <button className="social-btn twitter" onClick={() => handleShare('twitter')} title="Share on X">
                    <svg fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                </button>
                <button className="social-btn facebook" onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank')} title="Share on Facebook">
                    <svg fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                </button>
                <button className="social-btn reddit" onClick={() => window.open(`https://reddit.com/submit?url=${encodeURIComponent(window.location.href)}&title=${encodeURIComponent(post?.title || '')}`, '_blank')} title="Share on Reddit">
                    <svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" /></svg>
                </button>
                <button className="social-btn email" onClick={() => handleShare('email')} title="Share via Email">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </button>
            </aside>

            <div className="blog-wrapper">
                {/* Main Content */}
                <main className="blog-main">
                    <div className="blog-category-eyebrow">
                        {getCategoryDisplayName(post.category)}
                    </div>
                    <h1 className="blog-title">{post.title}</h1>

                    {post.thumbnail && (
                        <img
                            src={post.thumbnail.startsWith('http') ? post.thumbnail : `/blogs/${post.category}/${post.slug}/${post.thumbnail}`}
                            alt={post.title}
                            className="blog-hero-image"
                            onError={(e) => {
                                if (e.currentTarget.src !== genericImage) {
                                    e.currentTarget.src = genericImage;
                                }
                            }}
                        />
                    )}

                    {/* Meta Section */}
                    {/* ... (keep existing code) ... */}


                    <div className="blog-meta-container">
                        <div className="blog-meta-row">
                            <div className="meta-left">
                                <span className="blog-date">{formatDate(post.date)}</span>
                            </div>
                            <div className="meta-right">
                                <span className="meta-item like-btn-wrapper">
                                    <svg className="meta-icon" fill="currentColor" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" /><path d="M0 0h24v24H0z" fill="none" /></svg>
                                    Like
                                </span>
                                <span className="meta-item">
                                    <svg className="meta-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                                    Discuss (0)
                                </span>
                                <span className="meta-item">{readTime} min read</span>
                            </div>
                        </div>
                        <div className="blog-author-row">
                            By {post.author?.split(/,\s*|\s+and\s+/).map((author, i, arr) => (
                                <span key={i}>
                                    <a href={`/?author=${encodeURIComponent(author.trim())}`} className="author-link">{author.trim()}</a>
                                    {i < arr.length - 1 && (i === arr.length - 2 ? ' and ' : ', ')}
                                </span>
                            ))}
                        </div>
                    </div>

                    <BlogContent
                        html={post.content}
                        onRef={contentRef}
                        onClick={(e) => {
                            const target = e.target as HTMLElement;
                            const link = target.closest('a');
                            console.log('[BlogPost] Click detected on:', target.tagName, 'Link found:', !!link);
                            if (link && link.hash) {
                                const href = link.getAttribute('href') || '';
                                const isHashOnly = href.startsWith('#');
                                const isSameOrigin = link.origin === window.location.origin;
                                console.log('[BlogPost] Hash link:', { href, hash: link.hash, isHashOnly, isSameOrigin });
                                if (isHashOnly || isSameOrigin) {
                                    e.preventDefault();
                                    const id = link.hash.substring(1);
                                    let el = document.getElementById(id);
                                    // Try case-insensitive fallback
                                    if (!el) {
                                        const allIds = Array.from(document.querySelectorAll('[id]')).map(e => e.id);
                                        const match = allIds.find(existingId => existingId.toLowerCase() === id.toLowerCase());
                                        if (match) {
                                            console.log('[BlogPost] Found case-insensitive match:', match);
                                            el = document.getElementById(match);
                                        } else {
                                            console.warn('[BlogPost] No element found for id:', id, 'Available IDs:', allIds.filter(x => x.toLowerCase().includes('end')));
                                        }
                                    }
                                    if (el) {
                                        console.log('[BlogPost] Scrolling to:', el);
                                        const offset = 80;
                                        const elementPosition = el.getBoundingClientRect().top;
                                        const offsetPosition = elementPosition + window.pageYOffset - offset;
                                        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                                        setActiveId(id);
                                    }
                                }
                            }
                        }}
                    />

                    <div className="blog-footer">
                        <div className="blog-tags-verticals">
                            {post.verticals?.map((v, i) => (
                                <span key={`v-${i}`} className="tag-badge" style={{ border: '1px solid var(--rocm-primary)', background: 'rgba(59,130,246,0.1)', color: 'var(--rocm-primary)' }}>{v}</span>
                            ))}
                            {post.tags?.map((t, i) => (
                                <span key={`t-${i}`} className="tag-badge">#{t}</span>
                            ))}
                        </div>

                        <div className="share-section">
                            <span style={{ fontWeight: 600, marginRight: '0.5rem' }}>Share via:</span>
                            <button id="share-copy-btn" className="share-btn" onClick={() => handleShare('copy')} title="Copy Link">
                                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                            </button>
                            <button className="share-btn" onClick={() => handleShare('twitter')} title="Share on Twitter/X">
                                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                            </button>
                            <button className="share-btn" onClick={() => handleShare('linkedin')} title="Share on LinkedIn">
                                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" /></svg>
                            </button>
                            <button className="share-btn" onClick={() => handleShare('email')} title="Share via Email">
                                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            </button>
                        </div>
                    </div>
                </main>

                {/* Right Sidebar - ToC */}
                <aside className="blog-sidebar">
                    <details className="toc-dropdown" open>
                        <summary className="toc-header">
                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
                            Contents
                        </summary>
                        {toc.length > 0 ? (
                            <ul className="toc-container">
                                {/* Blog Title as first ToC item */}
                                <li className="toc-item toc-title">
                                    <a
                                        href="#top"
                                        className="toc-link toc-link-title"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                    >
                                        {post.title}
                                    </a>
                                </li>
                                {toc.map(item => (
                                    <li key={item.id} className={`toc-item h${item.level}`}>
                                        <a
                                            href={`#${item.id}`}
                                            className={`toc-link ${activeId === item.id ? 'active' : ''}`}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                const el = document.getElementById(item.id);
                                                if (el) {
                                                    const offset = 80;
                                                    const elementPosition = el.getBoundingClientRect().top;
                                                    const offsetPosition = elementPosition + window.pageYOffset - offset;
                                                    window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                                                    setActiveId(item.id);
                                                }
                                            }}
                                        >
                                            {item.text}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="toc-empty">No sections</div>
                        )}
                    </details>

                    {/* Related Posts */}
                    {relatedPosts.length > 0 && (
                        <details className="related-posts-dropdown">
                            <summary className="related-posts-header">Related posts</summary>
                            <div className="related-posts-content">
                                {relatedPosts.map((related) => (
                                    <Link
                                        key={related.slug}
                                        to={`/blog/${related.category}/${related.slug}`}
                                        className="related-post-card"
                                    >
                                        {(related.thumbnailUrl || related.thumbnail) && (
                                            <img
                                                src={related.thumbnailUrl || (related.thumbnail?.startsWith('http') ? related.thumbnail : `/blogs/${related.category}/${related.slug}/${related.thumbnail}`)}
                                                alt={related.title}
                                                className="related-post-image"
                                                onError={(e) => {
                                                    if (e.currentTarget.src !== genericImage) {
                                                        e.currentTarget.src = genericImage;
                                                    }
                                                }}
                                            />
                                        )}
                                        <h5 className="related-post-title">{related.title}</h5>
                                    </Link>
                                ))}
                            </div>
                        </details>
                    )}
                </aside>
            </div>

            {selectedImage && (
                <div
                    className="lightbox-overlay"
                    onClick={() => setSelectedImage(null)}
                >
                    <button className="lightbox-close" aria-label="Close">×</button>
                    <img
                        src={selectedImage}
                        alt="Enlarged view"
                        className="lightbox-image"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}
