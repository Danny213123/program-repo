import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { BlogMeta } from '../types/blog';
import { getCategoryDisplayName } from '../utils/markdown';
import defaultThumbnail from '../assets/generic.jpg';
import './FeaturedBanner.css';

interface FeaturedBannerProps {
    blogs: BlogMeta[];
}

export function FeaturedBanner({ blogs }: FeaturedBannerProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});
    const [progressKey, setProgressKey] = useState(0);
    // const defaultThumbnail = 'https://rocm.docs.amd.com/_static/rocm_logo_sticker_white_bg.svg';

    const goToSlide = useCallback((index: number) => {
        setCurrentIndex(index);
        setProgressKey(prev => prev + 1);
    }, []);

    // Handle animation end - switch to next slide when progress bar completes
    const handleProgressComplete = useCallback(() => {
        if (blogs.length > 1) {
            setCurrentIndex(prev => (prev + 1) % blogs.length);
            setProgressKey(prev => prev + 1);
        }
    }, [blogs.length]);

    if (blogs.length === 0) return null;

    const handleImageError = (index: number) => {
        setImageErrors(prev => ({ ...prev, [index]: true }));
    };

    const getImageUrl = (blog: BlogMeta, index: number) => {
        if (imageErrors[index]) return defaultThumbnail;
        return blog.thumbnailUrl || defaultThumbnail;
    };

    const getCategoryLabel = (blog: BlogMeta) => {
        return getCategoryDisplayName(blog.category);
    };

    return (
        <section className="featured-banner">
            {/* Main Featured Slide */}
            <div className="banner-main">
                {blogs.map((blog, index) => (
                    <div
                        key={blog.slug}
                        className={`banner-slide ${index === currentIndex ? 'active' : ''}`}
                    >
                        <div className="banner-content">
                            <span className="banner-category">
                                {getCategoryLabel(blog)}
                            </span>
                            <h2 className="banner-title">{blog.title}</h2>
                            {blog.description && (
                                <p className="banner-description">{blog.description}</p>
                            )}
                            <Link
                                to={`/blog/${blog.category}/${blog.slug}`}
                                className="banner-btn"
                            >
                                Read now
                            </Link>
                        </div>
                        <div className="banner-image">
                            <img
                                src={getImageUrl(blog, index)}
                                alt={blog.title}
                                onError={() => handleImageError(index)}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* Progress Bars - Below image */}
            <div className="banner-progress-bar">
                {blogs.map((blog, index) => (
                    <button
                        key={blog.slug}
                        className={`progress-item ${index === currentIndex ? 'active' : ''}`}
                        onClick={() => goToSlide(index)}
                        aria-label={`Go to slide ${index + 1}`}
                    >
                        <div className="progress-bg" />
                        {index === currentIndex && (
                            <div
                                key={`progress-${progressKey}`}
                                className="progress-fill"
                                onAnimationEnd={handleProgressComplete}
                            />
                        )}
                    </button>
                ))}
            </div>

            {/* Bottom Navigation */}
            <div className="banner-nav">
                {blogs.map((blog, index) => (
                    <button
                        key={blog.slug}
                        className={`nav-item ${index === currentIndex ? 'active' : ''}`}
                        onClick={() => goToSlide(index)}
                    >
                        <div className="nav-content">
                            <span className="nav-category">
                                {getCategoryLabel(blog)}
                            </span>
                            <span className="nav-title">{blog.title}</span>
                        </div>
                    </button>
                ))}
            </div>
        </section>
    );
}
