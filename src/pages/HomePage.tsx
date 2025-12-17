import { useState, useEffect, useMemo } from 'react';
import type { BlogMeta } from '../types/blog';
import { fetchBlogList, fetchFeaturedBlogs } from '../services/local';
import { config } from '../config';
import { FeaturedBanner } from '../components/FeaturedBanner';
import { CardSlider } from '../components/CardSlider';
import { BlogGrid } from '../components/BlogGrid';
import './HomePage.css';

// Categories to show on homepage (excluding HPC)
const HOME_CATEGORIES = ['artificial-intelligence', 'ecosystems-and-partners', 'software-tools-optimization'];

import { useSearchParams } from 'react-router-dom';

export function HomePage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeVertical = searchParams.get('tab') || 'all';

    const setActiveVertical = (id: string) => {
        setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);
            newParams.set('tab', id);
            return newParams;
        }, { replace: false }); // Push to history so back button works
    };

    const [blogs, setBlogs] = useState<BlogMeta[]>([]);
    const [featuredBlogs, setFeaturedBlogs] = useState<BlogMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // const [activeVertical, setActiveVertical] = useState<string>('all'); // Replaced by URL state

    useEffect(() => {
        async function loadBlogs() {
            try {
                setLoading(true);
                setError(null);

                const [allBlogs, featuredTitles] = await Promise.all([
                    fetchBlogList(),
                    fetchFeaturedBlogs()
                ]);

                setBlogs(allBlogs);

                // Start preloading in background worker
                const worker = new Worker(new URL('../workers/prefetch.worker.ts', import.meta.url), { type: 'module' });
                worker.postMessage({ type: 'PRELOAD_BLOGS', blogs: allBlogs });

                // Match featured blogs by title
                const featured = featuredTitles
                    .map(title => allBlogs.find(blog =>
                        blog.title.toLowerCase().includes(title.toLowerCase().substring(0, 30)) ||
                        title.toLowerCase().includes(blog.title.toLowerCase().substring(0, 30))
                    ))
                    .filter((blog): blog is BlogMeta => blog !== undefined)
                    .slice(0, 5);

                setFeaturedBlogs(featured.length > 0 ? featured : allBlogs.slice(0, 5));

            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load blogs');
            } finally {
                setLoading(false);
            }
        }

        loadBlogs();
    }, []);

    // Filter blogs based on active vertical (including HPC)
    const displayBlogs = useMemo(() => {
        if (activeVertical === 'all') return blogs;
        return blogs.filter(blog =>
            blog.verticals && blog.verticals.includes(activeVertical)
        );
    }, [blogs, activeVertical]);




    if (loading) {
        return (
            <div className="home-loading">
                <div className="loading-spinner" />
                <p>Loading ROCm Blogs...</p>
                <p className="loading-hint">Fetching content</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="home-error">
                <h2>Unable to Load Blogs</h2>
                <p>{error}</p>
                <button onClick={() => window.location.reload()}>Retry</button>
            </div>
        );
    }

    // Get category info
    const getCategoryInfo = (id: string) =>
        config.categories.find(c => c.id === id) || { id, displayName: id };

    return (
        <div className="home-page">
            {/* Vertical Filter Bar */}
            <div className="vertical-filter-bar">
                <div className="filter-container">
                    <button
                        className={`filter-btn ${activeVertical === 'all' ? 'active' : ''}`}
                        onClick={() => setActiveVertical('all')}
                    >
                        Home
                    </button>
                    {config.verticals.map(vertical => (
                        <button
                            key={vertical.id}
                            className={`filter-btn ${activeVertical === vertical.id ? 'active' : ''}`}
                            onClick={() => setActiveVertical(vertical.id)}
                        >
                            {vertical.displayName}
                        </button>
                    ))}
                </div>
            </div>

            {activeVertical === 'all' && featuredBlogs.length > 0 && (
                <FeaturedBanner blogs={featuredBlogs} />
            )}

            {activeVertical !== 'all' ? (
                <div className="page-container">
                    <section className="filtered-posts">
                        <div className="section-header">
                            <h2>{activeVertical} Articles</h2>
                            <span className="post-count">{displayBlogs.length} posts</span>
                        </div>
                        <BlogGrid blogs={displayBlogs} />
                    </section>
                </div>
            ) : (
                <>
                    {/* Recent Posts - exclude featured blogs */}
                    {(() => {
                        const featuredSlugs = new Set(featuredBlogs.map(b => b.slug));
                        const recentBlogs = [...blogs]
                            .filter(b => !featuredSlugs.has(b.slug))
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .slice(0, 7);

                        return (
                            <CardSlider
                                title="Recent Posts"
                                blogs={recentBlogs}
                                maxItems={7}
                            />
                        );
                    })()}

                    {/* Card Sliders for each category - exclude featured and recent */}
                    {(() => {
                        // Build exclusion set: featured + recent
                        const featuredSlugs = new Set(featuredBlogs.map(b => b.slug));
                        const recentBlogs = [...blogs]
                            .filter(b => !featuredSlugs.has(b.slug))
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .slice(0, 7);
                        const usedSlugs = new Set([
                            ...featuredBlogs.map(b => b.slug),
                            ...recentBlogs.map(b => b.slug)
                        ]);

                        return HOME_CATEGORIES.map(categoryId => {
                            const categoryBlogs = blogs
                                .filter(b => b.category === categoryId && !usedSlugs.has(b.slug));
                            if (categoryBlogs.length === 0) return null;
                            const info = getCategoryInfo(categoryId);

                            return (
                                <CardSlider
                                    key={categoryId}
                                    title={info.displayName}
                                    blogs={categoryBlogs}
                                    maxItems={7}
                                />
                            );
                        });
                    })()}
                </>
            )}
        </div>
    );
}
