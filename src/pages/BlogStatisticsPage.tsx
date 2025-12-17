import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { BlogMeta } from '../types/blog';
import { fetchBlogList } from '../services/local';
import { getCategoryDisplayName } from '../utils/markdown';
import './BlogStatisticsPage.css';


export function BlogStatisticsPage() {
    const [blogs, setBlogs] = useState<BlogMeta[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const data = await fetchBlogList();
                setBlogs(data);
            } catch (e) {
                console.error('Failed to load blogs', e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    // Calculate author statistics
    const authorStats = useMemo(() => {
        const authorMap: Record<string, BlogMeta[]> = {};

        blogs.forEach(blog => {
            const authorString = blog.author || 'Unknown';
            const authors = authorString.split(/,\s*/).filter(a => a.trim());

            authors.forEach(author => {
                const trimmedAuthor = author.trim();
                if (!authorMap[trimmedAuthor]) {
                    authorMap[trimmedAuthor] = [];
                }
                authorMap[trimmedAuthor].push(blog);
            });
        });

        // Sort by number of blogs
        return Object.entries(authorMap)
            .map(([name, blogs]) => ({ name, blogs }))
            .sort((a, b) => b.blogs.length - a.blogs.length);
    }, [blogs]);

    // Calculate category statistics
    const categoryStats = useMemo(() => {
        const catMap: Record<string, number> = {};

        blogs.forEach(blog => {
            catMap[blog.category] = (catMap[blog.category] || 0) + 1;
        });

        return Object.entries(catMap)
            .map(([id, count]) => ({ id, name: getCategoryDisplayName(id), count }))
            .sort((a, b) => b.count - a.count);
    }, [blogs]);

    // Calculate monthly statistics for the last year
    const monthlyStats = useMemo(() => {
        const now = new Date();
        const months: { month: string; count: number }[] = [];

        for (let i = 11; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const count = blogs.filter(blog => {
                const blogDate = new Date(blog.date);
                return blogDate.getFullYear() === date.getFullYear() &&
                    blogDate.getMonth() === date.getMonth();
            }).length;

            months.push({
                month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                count
            });
        }

        return months;
    }, [blogs]);

    if (loading) {
        return (
            <div className="stats-loading">
                <div className="loading-spinner" />
                <p>Loading statistics...</p>
            </div>
        );
    }

    const topAuthors = authorStats.slice(0, 20);
    const maxCount = Math.max(...categoryStats.map(c => c.count));

    return (
        <div className="stats-page">
            <div className="stats-container">
                <h1 className="stats-title">ROCm Blogs Statistics</h1>

                {/* Overview Cards */}
                <div className="stats-overview">
                    <div className="stat-card">
                        <span className="stat-value">{blogs.length}</span>
                        <span className="stat-label">Total Blogs</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-value">{authorStats.length}</span>
                        <span className="stat-label">Authors</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-value">{categoryStats.length}</span>
                        <span className="stat-label">Categories</span>
                    </div>
                </div>

                {/* Blogs by Category */}
                <section className="stats-section">
                    <h2>Blogs by Category</h2>
                    <div className="category-bars">
                        {categoryStats.map(cat => (
                            <div key={cat.id} className="category-bar-row">
                                <Link to={`/category/${cat.id}`} className="category-name">
                                    {cat.name}
                                </Link>
                                <div className="bar-container">
                                    <div
                                        className="bar-fill"
                                        style={{ width: `${(cat.count / maxCount) * 100}%` }}
                                    />
                                    <span className="bar-count">{cat.count}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Monthly Activity */}
                <section className="stats-section">
                    <h2>Monthly Activity (Last 12 Months)</h2>
                    <div className="monthly-chart">
                        {monthlyStats.map(m => (
                            <div key={m.month} className="month-bar">
                                <div
                                    className="month-fill"
                                    style={{
                                        height: `${Math.max(10, (m.count / Math.max(...monthlyStats.map(s => s.count))) * 100)}%`
                                    }}
                                >
                                    <span className="month-count">{m.count}</span>
                                </div>
                                <span className="month-label">{m.month}</span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Top Authors */}
                <section className="stats-section">
                    <h2>Top Authors</h2>
                    <div className="authors-grid">
                        {topAuthors.map(author => (
                            <div key={author.name} className="author-card">
                                <div className="author-header">
                                    <a
                                        href={`/author/${encodeURIComponent(author.name)}`}
                                        className="author-name"
                                    >
                                        {author.name}
                                    </a>
                                    <span className="author-count">{author.blogs.length} blog{author.blogs.length !== 1 ? 's' : ''}</span>
                                </div>
                                <ul className="author-blogs">
                                    {author.blogs.slice(0, 3).map(blog => (
                                        <li key={blog.slug}>
                                            <Link to={`/blog/${blog.category}/${blog.slug}`}>
                                                {blog.title}
                                            </Link>
                                        </li>
                                    ))}
                                    {author.blogs.length > 3 && (
                                        <li className="more-blogs">
                                            +{author.blogs.length - 3} more
                                        </li>
                                    )}
                                </ul>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
