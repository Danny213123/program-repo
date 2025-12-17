import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { BlogMeta } from '../types/blog';
import { fetchBlogList } from '../services/local';
import { config } from '../config';
import { BlogGrid } from '../components/BlogGrid';
import './CategoryPage.css';

export function CategoryPage() {
    const { category } = useParams<{ category: string }>();
    const [blogs, setBlogs] = useState<BlogMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const categoryInfo = config.categories.find(c => c.id === category);

    useEffect(() => {
        async function loadBlogs() {
            if (!category) return;

            try {
                setLoading(true);
                setError(null);
                const categoryBlogs = await fetchBlogList(category);
                setBlogs(categoryBlogs);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load category');
            } finally {
                setLoading(false);
            }
        }

        loadBlogs();
    }, [category]);

    if (!categoryInfo) {
        return (
            <div className="category-error">
                <h2>Category Not Found</h2>
                <p>The category "{category}" does not exist.</p>
                <Link to="/">← Back to Home</Link>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="category-loading">
                <div className="loading-spinner" />
                <p>Loading {categoryInfo.displayName}...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="category-error">
                <h2>Error Loading Category</h2>
                <p>{error}</p>
                <Link to="/">← Back to Home</Link>
            </div>
        );
    }

    return (
        <div className="category-page page-container">
            <nav className="category-breadcrumb">
                <Link to="/">Home</Link>
                <span className="breadcrumb-sep">/</span>
                <span>{categoryInfo.displayName}</span>
            </nav>

            <header className="category-header">
                <h1>{categoryInfo.displayName}</h1>
                <p className="category-count">{blogs.length} posts</p>
            </header>

            <nav className="category-nav">
                {config.categories.map(cat => (
                    <Link
                        key={cat.id}
                        to={`/category/${cat.id}`}
                        className={`category-nav-item ${cat.id === category ? 'active' : ''}`}
                    >
                        {cat.displayName}
                    </Link>
                ))}
            </nav>

            <BlogGrid blogs={blogs} />
        </div>
    );
}
