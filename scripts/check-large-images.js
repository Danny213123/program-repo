import fs from 'fs';
import path from 'path';

const BLOGS_DIR = path.resolve('..', 'rocm-blogs-internal', 'blogs');
const SIZE_LIMIT_MB = 1;

function scanDir(dir) {
    if (!fs.existsSync(dir)) return;

    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
        const fullPath = path.join(dir, item.name);

        if (item.isDirectory()) {
            if (item.name.startsWith('.') || item.name === 'node_modules') continue;
            scanDir(fullPath);
        } else {
            const ext = path.extname(item.name).toLowerCase();
            if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
                const stats = fs.statSync(fullPath);
                const sizeMB = stats.size / (1024 * 1024);

                if (sizeMB > SIZE_LIMIT_MB) {
                    console.log(`${sizeMB.toFixed(2)} MB: ${fullPath}`);
                }
            }
        }
    }
}

console.log(`Scanning for images larger than ${SIZE_LIMIT_MB}MB in ${BLOGS_DIR}...`);
scanDir(BLOGS_DIR);
console.log('Scan complete.');
