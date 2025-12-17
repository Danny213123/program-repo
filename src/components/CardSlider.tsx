import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { BlogMeta } from '../types/blog';
import { formatDate, getCategoryDisplayName } from '../utils/markdown';
import defaultThumbnail from '../assets/generic.jpg';
import './CardSlider.css';

interface CardSliderProps {
    title: string;
    blogs: BlogMeta[];
    maxItems?: number;
}

// const defaultThumbnail = 'https://rocm.docs.amd.com/_static/rocm_logo_sticker_white_bg.svg';

export function CardSlider({ title, blogs, maxItems = 7 }: CardSliderProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);
    const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

    const displayBlogs = blogs.slice(0, maxItems);

    const checkScroll = () => {
        if (!scrollRef.current) return;
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    };

    useEffect(() => {
        checkScroll();
    }, [displayBlogs]);

    const scroll = (direction: 'left' | 'right') => {
        if (!scrollRef.current) return;
        const cardWidth = 340;
        const scrollAmount = cardWidth * 2;
        scrollRef.current.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth'
        });
    };

    const handleImageError = (slug: string) => {
        setImageErrors(prev => ({ ...prev, [slug]: true }));
    };

    const getImageUrl = (blog: BlogMeta) => {
        if (imageErrors[blog.slug]) return defaultThumbnail;
        return blog.thumbnailUrl || defaultThumbnail;
    };

    if (displayBlogs.length === 0) return null;

    return (
        <section className="card-slider">
            <div className="slider-header">
                <h2 className="slider-title">{title}</h2>
                <div className="slider-controls">
                    <button
                        className={`slider-arrow ${!canScrollLeft ? 'disabled' : ''}`}
                        onClick={() => scroll('left')}
                        disabled={!canScrollLeft}
                        aria-label="Scroll left"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                    </button>
                    <button
                        className={`slider-arrow ${!canScrollRight ? 'disabled' : ''}`}
                        onClick={() => scroll('right')}
                        disabled={!canScrollRight}
                        aria-label="Scroll right"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 18l6-6-6-6" />
                        </svg>
                    </button>
                </div>
            </div>

            <div
                className="slider-track"
                ref={scrollRef}
                onScroll={checkScroll}
            >
                {displayBlogs.map((blog) => {
                    const blogUrl = `/blog/${blog.category}/${blog.slug}`;
                    const authorString = blog.author || 'Unknown';
                    const authors = authorString.split(/,\s*/).filter((a: string) => a.trim());

                    return (
                        <article key={blog.slug} className="slider-card">
                            <Link to={blogUrl} className="card-image">
                                <img
                                    src={getImageUrl(blog)}
                                    alt={blog.title}
                                    onError={() => handleImageError(blog.slug)}
                                />
                            </Link>
                            <div className="card-content">
                                <span className="card-category">
                                    {getCategoryDisplayName(blog.category)}
                                </span>
                                <Link to={blogUrl} className="card-title-link">
                                    <h3 className="card-title">{blog.title}</h3>
                                </Link>
                                {blog.description && (
                                    <p className="card-description">{blog.description}</p>
                                )}
                                <div className="card-meta">
                                    <span className="card-authors">
                                        {authors.map((author: string, index: number) => (
                                            <span key={author}>
                                                <a
                                                    href={`/author/${encodeURIComponent(author.trim())}`}
                                                    className="card-author-link"
                                                >
                                                    {author.trim()}
                                                </a>
                                                {index < authors.length - 1 && <span>, </span>}
                                            </span>
                                        ))}
                                    </span>
                                    <span className="card-date">{formatDate(blog.date)}</span>
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
