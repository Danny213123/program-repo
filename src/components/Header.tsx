import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import MiniSearch from 'minisearch';
import { config } from '../config';
import './Header.css';
import logo from '../assets/amd-header-logo.svg';

export function Header() {
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const saved = localStorage.getItem('theme');
        return (saved as 'light' | 'dark') || 'dark';
    });
    const [menuOpen, setMenuOpen] = useState(false);

    const location = useLocation();
    // const navigate = useNavigate();
    const searchRef = useRef<HTMLDivElement>(null);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchIndex, setSearchIndex] = useState<MiniSearch | null>(null);
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Load Search Index
    useEffect(() => {
        async function loadIndex() {
            try {
                const response = await fetch('/search-index.json');
                const data = await response.json();

                const miniSearch = new MiniSearch({
                    fields: ['title', 'content', 'description', 'tags', 'category'],
                    storeFields: ['title', 'description', 'category', 'id', 'tags'],
                    searchOptions: {
                        boost: { title: 2, tags: 1.5 },
                        fuzzy: 0.2, // typo tolerance
                        prefix: true
                    }
                });

                miniSearch.addAll(data);
                setSearchIndex(miniSearch);
            } catch (err) {
                console.error("Failed to load search index", err);
            }
        }
        loadIndex();
    }, []);

    // Handle Click Outside Search
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsSearchFocused(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearch = (query: string) => {
        setSearchQuery(query);
        if (searchIndex && query.length > 1) {
            // @ts-ignore
            const results = searchIndex.search(query).slice(0, 10);
            setSearchResults(results);
        } else {
            setSearchResults([]);
        }
    };

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    const isBlogPage = location.pathname.startsWith('/blog/');

    return (
        <header className={`rocm-header ${isBlogPage ? 'header-static' : ''}`}>
            <div className="header-container">
                <div className="header-left">
                    <div className="header-brand">
                        <Link to="/" className="logo-link">
                            <img src={logo} alt="AMD" className="amd-logo" width="90" height="22" />
                            <span className="brand-text">ROCm™ Blogs</span>
                        </Link>
                    </div>

                    {/* Search Bar - Moved to left */}
                    <div className="search-container" ref={searchRef}>
                        <div className="search-input-wrapper">
                            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8" />
                                <path d="m21 21-4.3-4.3" />
                            </svg>
                            <input
                                type="text"
                                className="search-input"
                                placeholder="Search blogs..."
                                value={searchQuery}
                                onChange={(e) => handleSearch(e.target.value)}
                                onFocus={() => setIsSearchFocused(true)}
                            />
                        </div>

                        {/* Search Results Dropdown */}
                        {isSearchFocused && searchQuery.length > 1 && (
                            <div className="search-results">
                                {searchResults.length > 0 ? (
                                    searchResults.map(result => (
                                        <Link
                                            key={result.id}
                                            to={`/blog/${result.category}/${result.id}`}
                                            className="search-result-item"
                                            onClick={() => {
                                                setIsSearchFocused(false);
                                                setSearchQuery('');
                                            }}
                                        >
                                            <div className="result-title">{result.title}</div>
                                            <div className="result-meta">
                                                <span className="result-category">
                                                    {config.categories.find(c => c.id === result.category)?.displayName || result.category}
                                                </span>
                                            </div>
                                        </Link>
                                    ))
                                ) : (
                                    <div className="no-results">No results found</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="header-actions">
                    {/* Community Dropdown */}
                    <div className="nav-dropdown">
                        <button className="nav-link dropdown-toggle icon-only" aria-label="Menu">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="3" y1="12" x2="21" y2="12"></line>
                                <line x1="3" y1="6" x2="21" y2="6"></line>
                                <line x1="3" y1="18" x2="21" y2="18"></line>
                            </svg>
                        </button>
                        <div className="dropdown-menu nested-menu">
                            <div className="menu-section">
                                <div className="menu-header">Community</div>
                                <div className="menu-items">
                                    <Link to="/" className="dropdown-item">Blogs</Link>
                                    <a href="#" className="dropdown-item">White Papers</a>
                                    <a href="https://github.com/ROCm/ROCm/discussions" target="_blank" rel="noopener noreferrer" className="dropdown-item">
                                        Community Discussions
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        className="theme-toggle"
                        onClick={toggleTheme}
                        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                    >
                        {theme === 'dark' ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                            </svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="4" />
                                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                            </svg>
                        )}
                    </button>

                    <button
                        className="mobile-menu-toggle"
                        onClick={() => setMenuOpen(!menuOpen)}
                        aria-label="Toggle menu"
                    >
                        <span className="hamburger"></span>
                    </button>
                </div>
            </div>
        </header>
    );
}
