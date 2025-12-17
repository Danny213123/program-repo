# ROCm Blog Platform

A React-based blog platform that reads directly from local blog files, similar to how rocm-blogs-sphinx works.

## Setup

### Directory Structure

The platform expects this directory structure:

```
root/
├── blogs/              ← Clone of ROCm/rocm-blogs (blog content)
│   ├── artificial-intelligence/
│   ├── ecosystems-and-partners/
│   ├── high-performance-computing/
│   ├── software-tools-optimization/
│   ├── images/
│   └── featured-blogs.csv
└── program/            ← This React app (rename folder to 'program')
    ├── src/
    ├── public/
    └── package.json
```

### Quick Start

1. **Clone the blogs content:**
   ```bash
   cd /path/to/root
   git clone https://github.com/ROCm/rocm-blogs.git blogs
   ```

2. **Navigate to the program folder:**
   ```bash
   cd program
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Generate blog index:**
   ```bash
   npm run generate-index
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

The app will be available at http://localhost:5173

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production (auto-generates blog index)
- `npm run generate-index` - Generate blog index from local files
- `npm run preview` - Preview production build

## How It Works

1. **Blog Index Generation**: The `scripts/generate-blog-index.ts` script scans the `../blogs` folder and creates a JSON index of all blogs at `public/blogs-index.json`

2. **Local File Serving**: A custom Vite plugin serves files from `../blogs` at the `/blogs` URL path

3. **No GitHub API**: Unlike the previous version, this reads all content locally - no rate limits, no network dependency during development

## Development

After changing blog content, regenerate the index:

```bash
npm run generate-index
```

## Building for Production

```bash
npm run build
```

The production build will be in the `dist/` folder. For deployment, you'll need to:
1. Copy the `blogs/` folder content to `dist/blogs/`
2. Serve the `dist/` folder with a static file server
