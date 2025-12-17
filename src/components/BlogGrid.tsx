import type { BlogMeta } from '../types/blog';
import { BlogCard } from './BlogCard';
import './BlogGrid.css';

interface BlogGridProps {
    blogs: BlogMeta[];
    title?: string;
    showFeatured?: boolean;
}

export function BlogGrid({ blogs, title, showFeatured = false }: BlogGridProps) {
    if (blogs.length === 0) {
        return (
            <div className="blog-grid-empty">
                <p>No blog posts found.</p>
            </div>
        );
    }

    return (
        <section className="blog-grid-section">
            {title && <h2 className="blog-grid-title">{title}</h2>}
            <div className="blog-grid">
                {blogs.map((blog, index) => (
                    <BlogCard
                        key={`${blog.category}-${blog.slug}`}
                        blog={blog}
                        featured={showFeatured && index === 0}
                    />
                ))}
            </div>
        </section>
    );
}
