import { useParams } from 'react-router-dom';
import { BlogPost } from '../components/BlogPost';

export function BlogPage() {
    const { category, '*': slugPath } = useParams<{ category: string; '*': string }>();

    // slugPath contains the rest of the URL after /blog/:category/
    const slug = slugPath || '';

    if (!category || !slug) {
        return (
            <div className="page-container">
                <h1>Blog Not Found</h1>
                <p>Invalid blog URL</p>
            </div>
        );
    }

    return <BlogPost category={category} slug={slug} />;
}
