import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to blogs directory
const BLOGS_DIR = path.resolve(__dirname, '../../rocm-blogs-internal/blogs');

console.log(`Optimization Script Started`);
console.log(`Target Directory: ${BLOGS_DIR}`);

if (!fs.existsSync(BLOGS_DIR)) {
    console.error(`❌ Blogs directory not found: ${BLOGS_DIR}`);
    process.exit(1);
}

function scanForReadmes(dir: string, fileList: string[] = []) {
    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            if (file.name.startsWith('.') || file.name === 'node_modules') continue;
            scanForReadmes(fullPath, fileList);
        } else if (file.name.toLowerCase() === 'readme.md') {
            fileList.push(fullPath);
        }
    }
    return fileList;
}

function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function updateReadme(readmePath: string, content: string, oldThumb: string, newThumb: string) {
    const regex = new RegExp(`(thumbnail:\\s*['"]?)${escapeRegExp(oldThumb)}(['"]?)`, 'g');

    if (regex.test(content)) {
        const newContent = content.replace(regex, `$1${newThumb}$2`);
        fs.writeFileSync(readmePath, newContent);
        console.log(`📝 Updated README: ${path.relative(BLOGS_DIR, readmePath)}`);
        return true;
    } else {
        console.warn(`⚠️ Could not find thumbnail line in raw content for ${readmePath}`);
        return false;
    }
}

async function processBlog(readmePath: string) {
    try {
        const content = fs.readFileSync(readmePath, 'utf-8');
        const parsed = matter(content);
        const { data } = parsed;

        if (!data.thumbnail) return;

        let thumbnailPath = data.thumbnail as string;

        if (thumbnailPath.startsWith('http')) return;
        if (thumbnailPath.toLowerCase().endsWith('.webp')) return;

        const blogDir = path.dirname(readmePath);

        // Try direct path first
        let fullImagePath = path.resolve(blogDir, thumbnailPath);
        let validPath = '';
        let needsPathUpdateInReadme = false;
        let finalRelativePath = '';

        if (fs.existsSync(fullImagePath)) {
            validPath = fullImagePath;
            finalRelativePath = thumbnailPath.replace(/\.[^/.]+$/, "") + ".webp";;
        } else {
            // Try images/ subdir if not already there
            const subdirPath = path.resolve(blogDir, 'images', thumbnailPath);
            if (fs.existsSync(subdirPath)) {
                validPath = subdirPath;
                console.log(`🔎 Found in images subdir: ${path.basename(subdirPath)}`);
                needsPathUpdateInReadme = true;
                // If the original was just "thumb.png", new should be "images/thumb.webp"
                // If original was "subdir/thumb.png", this logic might be weird, but let's assume flat filenames for this fallback.
                finalRelativePath = 'images/' + thumbnailPath.replace(/\.[^/.]+$/, "") + ".webp";
            }
        }

        if (!validPath) {
            // Check if WebP already exists (maybe from failed previous run)
            // Try checks for both root and images/
            const potentialWebPRoot = path.resolve(blogDir, thumbnailPath.replace(/\.[^/.]+$/, "") + ".webp");
            if (fs.existsSync(potentialWebPRoot)) {
                console.log(`⚠️ WebP already exists (root): ${path.basename(potentialWebPRoot)}`);
                updateReadme(readmePath, content, thumbnailPath, thumbnailPath.replace(/\.[^/.]+$/, "") + ".webp");
                return;
            }

            // Check images/ webp
            const potentialWebPImages = path.resolve(blogDir, 'images', thumbnailPath.replace(/\.[^/.]+$/, "") + ".webp");
            if (fs.existsSync(potentialWebPImages)) {
                console.log(`⚠️ WebP already exists (images/): ${path.basename(potentialWebPImages)}`);
                // Must update README to point to images/
                updateReadme(readmePath, content, thumbnailPath, 'images/' + thumbnailPath.replace(/\.[^/.]+$/, "") + ".webp");
                return;
            }

            // console.warn(`⚠️ Thumbnail not found: ${fullImagePath}`);
            return;
        }

        const newFullWebPPath = path.resolve(blogDir, finalRelativePath);

        console.log(`Processing: ${path.basename(validPath)} -> ${finalRelativePath}`);

        await sharp(validPath)
            .resize({
                width: 1920,
                height: 1080,
                fit: 'inside',
                withoutEnlargement: true
            })
            .webp({ quality: 80 })
            .toFile(newFullWebPPath);

        const updated = updateReadme(readmePath, content, thumbnailPath, finalRelativePath);

        if (updated) {
            try {
                fs.unlinkSync(validPath);
            } catch (e) {
                console.warn(`⚠️ Could not delete original: ${validPath}`);
            }
        } else {
            // If readme update failed, maybe we should delete the created webp to avoid mess? 
            // Or keep it. Keeping it is safer.
        }

        console.log(`✅ Optimized: ${path.relative(BLOGS_DIR, readmePath)}`);

    } catch (error) {
        console.error(`❌ Error processing ${readmePath}:`, error);
    }
}

async function main() {
    console.log('🔍 Scanning for blog READMEs...');
    const readmes = scanForReadmes(BLOGS_DIR);
    console.log(`Found ${readmes.length} blog files.`);

    for (const readme of readmes) {
        await processBlog(readme);
    }

    console.log('🎉 Optimization Complete!');
}

main();
