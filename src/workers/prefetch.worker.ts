/// <reference lib="webworker" />

self.onmessage = async (e: MessageEvent) => {
    const { type, blogs } = e.data;

    if (type === 'PRELOAD_BLOGS' && Array.isArray(blogs)) {
        console.log(`[Worker] Starting preload for ${blogs.length} blogs...`);

        try {
            const cache = await caches.open('blog-content-v1');

            // Limit concurrency to avoid overwhelming the network
            const batchSize = 5;
            for (let i = 0; i < blogs.length; i += batchSize) {
                const batch = blogs.slice(i, i + batchSize);

                await Promise.all(batch.map(async (blog: any) => {
                    const url = `/blogs/${blog.category}/${blog.slug}/README.md`;
                    try {
                        // Check if already in cache
                        const match = await cache.match(url);
                        if (!match) {
                            console.log(`[Worker] Fetching ${url}`);
                            await cache.add(url);
                        }
                    } catch (err) {
                        console.error(`[Worker] Failed to preload ${url}`, err);
                    }
                }));
            }

            console.log('[Worker] Preload complete');
            self.postMessage({ type: 'PRELOAD_COMPLETE' });
        } catch (err) {
            console.error('[Worker] Cache open failed', err);
        }
    }
};

// Typescript needs this to treat file as a module
export { };
