export interface BlogMeta {
    slug: string;
    path: string;
    category: string;
    title: string;
    date: string;
    author: string;
    thumbnail: string;
    thumbnailUrl?: string;
    thumbnailAltUrls?: string[];
    tags: string[];
    description: string;
    language: string;
    verticals: string[];  // Market verticals: AI, HPC, Data Science, Systems, Developers, Robotics
}

export interface BlogPost extends BlogMeta {
    content: string;
    rawContent: string;
    math?: Record<string, string>;
}

export interface BlogFrontmatter {
    blogpost: boolean;
    blog_title: string;
    date: string;
    author: string;
    thumbnail: string;
    tags: string;
    category: string;
    language: string;
    target_audience?: string;
    key_value_propositions?: string;
    math?: Record<string, string>;
    myst?: {
        html_meta?: {
            [key: string]: string;
        };
    };
}

export interface GitHubContent {
    name: string;
    path: string;
    sha: string;
    size: number;
    url: string;
    html_url: string;
    git_url: string;
    download_url: string | null;
    type: 'file' | 'dir';
}
