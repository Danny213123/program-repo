// @ts-nocheck
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const SOURCE = path.resolve(__dirname, '../../rocm-blogs-internal/blogs');
const DEST = path.resolve(__dirname, '../dist/blogs');

console.log(`[copy-blogs] Source: ${SOURCE}`);
console.log(`[copy-blogs] Dest: ${DEST}`);

// Function to copy directory recursively
function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        // Skip ignored files/folders
        if (entry.name.startsWith('.') || entry.name.startsWith('_') || entry.name === 'node_modules') {
            continue;
        }

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

try {
    if (fs.existsSync(SOURCE)) {
        console.log('[copy-blogs] Copying blogs...');
        copyDir(SOURCE, DEST);
        console.log('[copy-blogs] Done!');
    } else {
        console.error(`[copy-blogs] Source directory not found: ${SOURCE}`);
        process.exit(1);
    }
} catch (error) {
    console.error('[copy-blogs] Failed:', error);
    process.exit(1);
}
