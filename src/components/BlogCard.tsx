import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { BlogMeta } from '../types/blog';
import { formatDate, getCategoryDisplayName } from '../utils/markdown';
import defaultThumbnail from '../assets/generic.jpg';
import './BlogCard.css';

interface BlogCardProps {
    blog: BlogMeta;
    featured?: boolean;
}

export function BlogCard({ blog, featured = false }: BlogCardProps) {
    // const defaultThumbnail = 'https://rocm.docs.amd.com/_static/rocm_logo_sticker_white_bg.svg';
    const [altUrlIndex, setAltUrlIndex] = useState(0);
    const [useFallback, setUseFallback] = useState(false);

    const blogUrl = `/blog/${blog.category}/${blog.slug}`;

    const getCurrentImageUrl = (): string => {
        if (useFallback) return defaultThumbnail;
        if (!blog.thumbnailUrl) return defaultThumbnail;
        if (altUrlIndex === 0) return blog.thumbnailUrl;
        if (blog.thumbnailAltUrls && altUrlIndex <= blog.thumbnailAltUrls.length) {
            return blog.thumbnailAltUrls[altUrlIndex - 1];
        }
        return defaultThumbnail;
    };

    const handleImageError = () => {
        const altUrls = blog.thumbnailAltUrls || [];
        const totalUrls = 1 + altUrls.length;
        if (altUrlIndex < totalUrls) {
            setAltUrlIndex(prev => prev + 1);
        } else {
            setUseFallback(true);
        }
    };

    // Split authors by comma and render each as a separate link
    const renderAuthors = () => {
        const authorString = blog.author || 'Unknown';
        const authors = authorString.split(/,\s*/).filter(a => a.trim());

        return authors.map((author, index) => (
            <span key={author}>
                <a
                    href={`/author/${encodeURIComponent(author.trim())}`}
                    className="blog-card-author-link"
                >
                    {author.trim()}
                </a>
                {index < authors.length - 1 && <span className="author-comma">, </span>}
            </span>
        ));
    };

    return (
        <article className={`blog-card ${featured ? 'featured' : ''}`}>
            <Link to={blogUrl} className="blog-card-image">
                <img
                    src={getCurrentImageUrl()}
                    alt={blog.title}
                    loading="lazy"
                    onError={handleImageError}
                />
                {/* Vertical badges */}
                {blog.verticals && blog.verticals.length > 0 && (
                    <div className="blog-card-verticals">
                        {blog.verticals.slice(0, 2).map(vertical => (
                            <span key={vertical} className="vertical-badge">{vertical}</span>
                        ))}
                    </div>
                )}
            </Link>
            <div className="blog-card-content">
                <span className="blog-card-category">
                    {getCategoryDisplayName(blog.category)}
                </span>
                <Link to={blogUrl} className="blog-card-title-link">
                    <h3 className="blog-card-title">{blog.title}</h3>
                </Link>
                {blog.description && (
                    <p className="blog-card-description">{blog.description}</p>
                )}
                <div className="blog-card-meta">
                    <span className="blog-card-authors">{renderAuthors()}</span>
                    <span className="blog-card-separator">|</span>
                    <span className="blog-card-date">{formatDate(blog.date)}</span>
                </div>
            </div>
        </article>
    );
}
