// Content source configuration
// Set via environment variables at build time:
//   VITE_GITHUB_REPO - The GitHub repo to fetch content from (e.g., "MyOrg/rocm-blogs-internal")
//   VITE_GITHUB_BRANCH - The branch to fetch from (e.g., "develop" or "main")
//
// Defaults to the live public repo if not specified
// CI pipelines should set these vars appropriately:
//   - Internal repo CI → sets to internal repo/branch
//   - Live repo CI → uses defaults (ROCm/rocm-blogs @ release)

export const config = {
  // GitHub repository - defaults to live public repo
  githubRepo: import.meta.env.VITE_GITHUB_REPO || 'ROCm/rocm-blogs',

  // Branch - defaults to release
  githubBranch: import.meta.env.VITE_GITHUB_BRANCH || 'release',

  blogsPath: 'blogs',
  categories: [
    { id: 'artificial-intelligence', name: 'Applications & Models', displayName: 'Applications & Models' },
    { id: 'ecosystems-and-partners', name: 'Ecosystems & Partners', displayName: 'Ecosystems & Partners' },
    { id: 'high-performance-computing', name: 'HPC', displayName: 'High Performance Computing' },
    { id: 'software-tools-optimization', name: 'Software Tools & Optimizations', displayName: 'Software Tools & Optimizations' }
  ],
  verticals: [
    { id: 'AI', displayName: 'AI' },
    { id: 'HPC', displayName: 'HPC' },
    { id: 'Data Science', displayName: 'Data Science' },
    { id: 'Systems', displayName: 'Systems' },
    { id: 'Developers', displayName: 'Developers' }
  ],
  featuredBlogsCsv: 'blogs/featured-blogs.csv',
  postsPerPage: 12,
  githubApiBase: 'https://api.github.com',
  githubRawBase: 'https://raw.githubusercontent.com'
};

export type Category = typeof config.categories[number];
export type Vertical = typeof config.verticals[number];
