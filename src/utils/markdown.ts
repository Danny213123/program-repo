import { Buffer } from 'buffer';
import matter from 'gray-matter';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';

import rehypeStringify from 'rehype-stringify';
import type { BlogPost, BlogFrontmatter } from '../types/blog';
import { getThumbnailUrl } from '../services/local';

/**
 * Escape HTML special characters for safe embedding
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export async function parseMarkdown(rawContent: string, category: string, slug: string): Promise<BlogPost> {
    const { data, content } = matter(rawContent);
    const frontmatter = data as BlogFrontmatter;

    const htmlContent = await renderMarkdownContent(rawContent, category, slug);

    const description = frontmatter.myst?.html_meta?.['description lang=en'] || '';
    const tags = frontmatter.tags ? frontmatter.tags.split(',').map(t => t.trim()) : [];

    return {
        slug,
        path: `blogs/${category}/${slug}`,
        category,
        title: frontmatter.blog_title || slug,
        date: frontmatter.date || '',
        author: frontmatter.author || 'Unknown',
        thumbnail: frontmatter.thumbnail || '',
        thumbnailUrl: frontmatter.thumbnail ? getThumbnailUrl(category, slug, frontmatter.thumbnail) : undefined,
        tags,
        description,
        language: frontmatter.language || 'English',
        verticals: [],
        content: htmlContent,
        rawContent: content,
        math: frontmatter.math
    };
}

/**
 * Handle MyST math syntax
 */
function parseMystMath(content: string): string {
    let result = content;
    const equations: Record<string, { number: number, id: string }> = {};
    let eqCounter = 0;

    const escapeMath = (math: string) => {
        return math.replace(/\\/g, '\\\\');
    };

    // Parse ```{math} ... ``` directives
    result = result.replace(/```\{math\}\s*\n([\s\S]*?)```/g, (_: string, fullBody: string) => {
        const lines = fullBody.split('\n');
        let options: Record<string, string> = {};
        let mathLines: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();
            const optionMatch = trimmed.match(/^:(\w+):\s*(.*)$/);
            if (optionMatch) {
                options[optionMatch[1]] = optionMatch[2];
            } else {
                mathLines.push(line);
            }
        }

        const mathContent = mathLines.join('\n').trim();
        const label = options['label'];

        if (label) {
            eqCounter++;
            equations[label] = { number: eqCounter, id: label };
            return `<div class="equation-block" id="${label}">` +
                '\\[' + mathContent + '\\]' +
                `<span class="equation-number">(${eqCounter})</span>` +
                '</div>';
        }

        return `<div class="equation-block">` +
            '\\[' + mathContent + '\\]' +
            '</div>';
    });

    // Parse $$ ... $$ (label)
    result = result.replace(/\$\$\s*([\s\S]*?)\$\$\s*\(([^)]+)\)/g, (_, math, label) => {
        eqCounter++;
        equations[label] = { number: eqCounter, id: label };
        return '<div class="equation-block" id="' + label + '">' +
            '\\[' + math.trim() + '\\]' +
            '<span class="equation-number">(' + eqCounter + ')</span>' +
            '</div>';
    });

    // Parse AMS environments
    const amsEnvs = ['equation', 'equation\\*', 'align', 'align\\*', 'gather', 'gather\\*', 'multline', 'multline\\*', 'alignat', 'alignat\\*', 'split'];
    for (const env of amsEnvs) {
        const cleanEnv = env.replace('\\*', '*');
        const regex = new RegExp('\\\\begin\\{' + env + '\\}([\\s\\S]*?)\\\\end\\{' + env + '\\}', 'g');
        result = result.replace(regex, (_, envContent) => {
            let id = '';
            let content = envContent;
            content = content.replace(/\\label\{([^}]+)\}/, (_: string, label: string) => {
                id = label;
                eqCounter++;
                equations[label] = { number: eqCounter, id: label };
                return `\\label{${label}}`;
            });

            const idAttr = id ? ` id="${id}"` : '';
            const numberSpan = id ? `<span class="equation-number">(${eqCounter})</span>` : '';

            return `<div class="equation-block ams-env"${idAttr}>` +
                '\\[' + '\\begin{' + cleanEnv + '}' + content + '\\end{' + cleanEnv + '}' + '\\]' +
                numberSpan +
                '</div>';
        });
    }

    // Parse remaining $$...$$
    result = result.replace(/\$\$\s*([\s\S]*?)\$\$/g, (_: string, math: string) => {
        let label = '';
        const cleanMath = math.replace(/\\label\s*\{([^}]+)\}/, (_: string, l: string) => {
            label = l;
            return '';
        });

        if (label) {
            eqCounter++;
            equations[label] = { number: eqCounter, id: label };
            return `<div class="equation-block" id="${label}">` +
                '\\[' + cleanMath.trim() + '\\]' +
                `<span class="equation-number">(${eqCounter})</span>` +
                '</div>';
        }

        return '<div class="equation-block">' +
            '\\[' + cleanMath.trim() + '\\]' +
            '</div>';
    });

    // Parse {eq}`label` role
    result = result.replace(/\{eq\}`([^`]+)`/g, (_, label) => {
        const eq = equations[label];
        if (eq) {
            return `<a href="#${label}" class="eq-ref">(${eq.number})</a>`;
        }
        return `<a href="#${label}" class="eq-ref eq-pending" data-label="${label}">(?)</a>`;
    });

    // Parse [](#label)
    result = result.replace(/\[\]\(#([^)]+)\)/g, (_, label) => {
        const eq = equations[label];
        if (eq) {
            return `<a href="#${label}" class="eq-ref">(${eq.number})</a>`;
        }
        return `<a href="#${label}" class="eq-ref eq-pending" data-label="${label}">(?)</a>`;
    });

    // Parse {math}`...` role
    result = result.replace(/\{math(?:\s+[^}]+)?\}`([^`]+)`/g, (_: string, math: string) => {
        return '\\\\(' + escapeMath(math) + '\\\\)';
    });

    // Parse regular inline $...$ math
    result = result.replace(/\$([^$\n]+)\$/g, (_, math) => {
        return '\\\\(' + escapeMath(math) + '\\\\)';
    });

    // Parse :::math directive
    result = result.replace(/:::\{math\}\s*\n([\s\S]*?):::/g, (_: string, content: string) => {
        const lines = content.split('\n');
        let mathContent = '';
        let label = '';
        let enumerated = true;

        for (const line of lines) {
            const trimmed = line.trim();
            const labelMatch = trimmed.match(/^:label:\s*(\S+)/);
            const enumMatch = trimmed.match(/^:enumerated:\s*(true|false)/);

            if (labelMatch) {
                label = labelMatch[1];
            } else if (enumMatch) {
                enumerated = enumMatch[1] === 'true';
            } else {
                mathContent += line + '\n';
            }
        }

        mathContent = mathContent.trim();

        if (enumerated && label) {
            eqCounter++;
            equations[label] = { number: eqCounter, id: label };
            return `<div class="equation-block" id="${label}">` +
                '\\[' + mathContent + '\\]' +
                `<span class="equation-number">(${eqCounter})</span>` +
                '</div>';
        }

        return `<div class="equation-block">` +
            '\\[' + mathContent + '\\]' +
            '</div>';
    });

    return result;
}

/**
 * Parse MyST ```{figure} directives
 * Supports:
 * - ```{figure} path/to/image.png
 * - ```{figure} #target-name (reference to named target)
 * 
 * Also parses (name)=![alt](url) target definitions
 */
function parseMystFigures(content: string): string {
    // First, extract and store all target definitions: (name)=![alt](url)
    const targets: Record<string, { alt: string; src: string }> = {};

    // Parse target syntax: (target-name)=![alt text](image-url)
    let processedContent = content.replace(
        /^\(([^)]+)\)=!\[([^\]]*)\]\(([^)]+)\)$/gm,
        (_, targetName, alt, src) => {
            // Convert GitHub blob URLs to raw URLs for direct image access
            let imageSrc = src;
            if (src.includes('github.com') && src.includes('/blob/')) {
                imageSrc = src
                    .replace('github.com', 'raw.githubusercontent.com')
                    .replace('/blob/', '/');
            }
            targets[targetName] = { alt: alt || '', src: imageSrc };
            return `<!-- target:${targetName} defined -->`;
        }
    );

    // Now parse figure directives
    return processedContent.replace(/```\{figure\}\s*(\S+)\s*\n([\s\S]*?)```/g, (_, imagePath, body) => {
        const options: Record<string, string> = {};
        let captionLines: string[] = [];

        const lines = body.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            const match = trimmed.match(/^:(\w+):\s*(.*)$/);
            if (match) {
                options[match[1]] = match[2];
            } else if (trimmed) {
                captionLines.push(line);
            } else if (captionLines.length > 0) {
                captionLines.push(line);
            }
        }

        const caption = captionLines.join('\n').trim();

        // Check if imagePath is a reference (#target-name)
        let actualImagePath = imagePath;
        let defaultAlt = '';

        if (imagePath.startsWith('#')) {
            const targetName = imagePath.slice(1);
            const target = targets[targetName];
            if (target) {
                actualImagePath = target.src;
                defaultAlt = target.alt;
            } else {
                // Target not found, use the reference as-is
                actualImagePath = '';
                defaultAlt = `Target "${targetName}" not found`;
            }
        }

        const alt = options['alt'] || defaultAlt || caption.replace(/\n/g, ' ').substring(0, 100) || '';
        const width = options['width'] ? ` width="${options['width']}"` : '';
        const alignClass = options['align'] ? ` align-${options['align']}` : '';
        const labelId = options['label'] ? ` id="${options['label']}"` : '';
        const nameId = options['name'] ? ` id="${options['name']}"` : '';
        const idAttr = labelId || nameId;

        if (!actualImagePath) {
            return `<figure class="myst-figure${alignClass}"${idAttr}><div class="figure-error">Image target not found</div>${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
        }

        // Check if this is a video file
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
        const isVideo = videoExtensions.some(ext => actualImagePath.toLowerCase().endsWith(ext));

        if (isVideo) {
            return `<figure class="myst-figure myst-video${alignClass}"${idAttr}><video controls preload="metadata"${width}><source src="${actualImagePath}" type="video/${actualImagePath.split('.').pop()}">Your browser does not support the video tag.</video>${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
        }

        return `<figure class="myst-figure${alignClass}"${idAttr}><img src="${actualImagePath}" alt="${alt}"${width} loading="lazy" />${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
    });
}

/**
 * Parse MyST directives using a line-by-line state machine.
 */
function parseMystDirectives(content: string): string {
    // Normalize line endings and split
    const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const result: string[] = [];

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];

        // Match colon-style: :::{directive} or ::::{directive}
        const colonMatch = line.match(/^(:{3,4})\{([\w:-]+)\}\s*(.*)$/);
        // Match backtick-style: ```{directive} or ````{directive}
        const backtickMatch = line.match(/^(`{3,4})\{([\w:-]+)\}\s*(.*)$/);

        const directiveMatch = colonMatch || backtickMatch;

        if (directiveMatch) {
            const fence = directiveMatch[1]; // ::: or ``` (3-4 chars)
            const name = directiveMatch[2];
            const titleArg = directiveMatch[3].trim();

            // Determine closing pattern based on fence type
            const fenceChar = fence[0]; // ':' or '`'
            const fenceLen = fence.length;
            const closingPattern = new RegExp(`^${fenceChar === ':' ? ':' : '`'}{${fenceLen}}\\s*$`);
            const openingPattern = new RegExp(`^${fenceChar === ':' ? ':' : '`'}{${fenceLen}}\\{[\\w:-]+`);

            let endIndex = -1;
            let depth = 1;

            for (let j = i + 1; j < lines.length; j++) {
                if (lines[j].match(openingPattern)) {
                    depth++;
                } else if (closingPattern.test(lines[j])) {
                    depth--;
                    if (depth === 0) {
                        endIndex = j;
                        break;
                    }
                }
            }

            if (endIndex > i) {
                const bodyLines = lines.slice(i + 1, endIndex);

                const optionLines: string[] = [];
                const contentLines: string[] = [];
                let inOptions = true;

                for (const bodyLine of bodyLines) {
                    const trimmed = bodyLine.trim();
                    if (inOptions && /^:\w+(?:-\w+)?:/.test(trimmed)) {
                        optionLines.push(trimmed);
                    } else if (trimmed === '' && inOptions) {
                        continue;
                    } else {
                        inOptions = false;
                        contentLines.push(bodyLine);
                    }
                }

                const bodyContent = contentLines.join('\n').trim();
                const parsedBody = parseMystDirectives(bodyContent);
                const html = generateDirectiveHtml(name, titleArg, optionLines, parsedBody);
                result.push(html);

                i = endIndex + 1;
                continue;
            }
        }

        result.push(line);
        i++;
    }

    return result.join('\n');
}

function generateDirectiveHtml(name: string, titleArg: string, optionLines: string[], bodyContent: string): string {
    const isOpen = optionLines.some(o => o === ':open:') || titleArg.includes(':open:');

    switch (name) {
        case 'dropdown': {
            const dropdownTitle = titleArg.replace(':open:', '').trim() || 'Details';
            return `<details class="dropdown"${isOpen ? ' open' : ''}><summary>${dropdownTitle}</summary><div class="dropdown-content">\n\n${bodyContent}\n\n</div></details>`;
        }

        case 'note':
        case 'warning':
        case 'tip':
        case 'important':
        case 'caution':
        case 'danger':
        case 'hint':
        case 'seealso': {
            const admonitionTitle = titleArg || name.charAt(0).toUpperCase() + name.slice(1);
            return `<div class="admonition ${name}"><div class="admonition-title">${admonitionTitle}</div>\n\n${bodyContent}\n\n</div>`;
        }

        case 'card': {
            const cardTitle = titleArg || 'Card';
            const headerOpt = optionLines.find(o => o.startsWith(':header:'));
            const header = headerOpt ? headerOpt.replace(/^:header:\s*/, '').trim() : cardTitle;
            const footerOpt = optionLines.find(o => o.startsWith(':footer:'));
            const footer = footerOpt ? footerOpt.replace(/^:footer:\s*/, '').trim() : '';
            const linkOpt = optionLines.find(o => o.startsWith(':link:'));
            const link = linkOpt ? linkOpt.replace(/^:link:\s*/, '').trim() : '';

            let cardHtml = link ? `<a href="${link}" class="card" target="_blank" rel="noopener">` : '<div class="card">';
            if (header) cardHtml += `<div class="card-header">${header}</div>`;
            cardHtml += `<div class="card-body">\n\n${bodyContent}\n\n</div>`;
            if (footer) cardHtml += `<div class="card-footer">${footer}</div>`;
            cardHtml += link ? '</a>' : '</div>';
            return cardHtml;
        }

        case 'grid': {
            const cols = titleArg.split(' ').pop() || '3';
            return `<div class="grid" data-columns="${cols}">\n\n${bodyContent}\n\n</div>`;
        }

        case 'tab-set': {
            return `<div class="tab-set">\n\n${bodyContent}\n\n</div>`;
        }

        case 'tab-item': {
            const tabTitle = titleArg || 'Tab';
            return `<div class="tab-item" data-title="${tabTitle}">\n\n${bodyContent}\n\n</div>`;
        }

        // MyST proof directives (prf:proof, prf:theorem, prf:lemma, etc.)
        case 'prf:proof':
        case 'prf:theorem':
        case 'prf:lemma':
        case 'prf:definition':
        case 'prf:criterion':
        case 'prf:remark':
        case 'prf:conjecture':
        case 'prf:corollary':
        case 'prf:algorithm':
        case 'prf:example':
        case 'prf:property':
        case 'prf:observation':
        case 'prf:proposition':
        case 'prf:assumption': {
            const prfType = name.split(':')[1];
            const prfTitle = prfType.charAt(0).toUpperCase() + prfType.slice(1);
            const labelOpt = optionLines.find(o => o.startsWith(':label:'));
            const label = labelOpt ? labelOpt.replace(/^:label:\s*/, '').trim() : '';
            const idAttr = label ? ` id="${label}"` : '';
            return `<div class="prf-block prf-${prfType}"${idAttr}><div class="prf-title">${prfTitle}</div><div class="prf-content">\n\n${bodyContent}\n\n</div></div>`;
        }

        // iframe directive for YouTube, Vimeo, etc.
        case 'iframe': {
            const url = titleArg;
            const widthOpt = optionLines.find(o => o.startsWith(':width:'));
            const width = widthOpt ? widthOpt.replace(/^:width:\s*/, '').trim() : '100%';
            const titleOpt = optionLines.find(o => o.startsWith(':title:'));
            const iframeTitle = titleOpt ? titleOpt.replace(/^:title:\s*/, '').trim() : 'Embedded content';
            const labelOpt = optionLines.find(o => o.startsWith(':label:'));
            const label = labelOpt ? labelOpt.replace(/^:label:\s*/, '').trim() : '';
            const idAttr = label ? ` id="${label}"` : '';

            // Convert YouTube watch URLs to embed URLs
            let embedUrl = url;
            if (url.includes('youtube.com/watch')) {
                const videoId = url.match(/[?&]v=([^&]+)/)?.[1];
                if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}`;
            } else if (url.includes('youtu.be/')) {
                const videoId = url.split('youtu.be/')[1]?.split('?')[0];
                if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}`;
            }

            return `<figure class="myst-iframe"${idAttr}><iframe src="${embedUrl}" width="${width}" height="400" title="${iframeTitle}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>${bodyContent ? `<figcaption>${bodyContent}</figcaption>` : ''}</figure>`;
        }

        // Video directive
        case 'video': {
            const videoPath = titleArg;
            const widthOpt = optionLines.find(o => o.startsWith(':width:'));
            const width = widthOpt ? widthOpt.replace(/^:width:\s*/, '').trim() : '';
            const heightOpt = optionLines.find(o => o.startsWith(':height:'));
            const height = heightOpt ? heightOpt.replace(/^:height:\s*/, '').trim() : '';
            const alignOpt = optionLines.find(o => o.startsWith(':align:'));
            const align = alignOpt ? alignOpt.replace(/^:align:\s*/, '').trim() : 'center';

            // Boolean attributes
            const controls = optionLines.some(o => o.startsWith(':controls:'));
            const autoplay = optionLines.some(o => o.startsWith(':autoplay:'));
            const loop = optionLines.some(o => o.startsWith(':loop:'));
            const muted = optionLines.some(o => o.startsWith(':muted:'));

            const styleAttrs = [];
            if (width) styleAttrs.push(`width: ${width}px; max-width: 100%;`);
            if (height) styleAttrs.push(`height: ${height}px;`);

            const attrs = [];
            if (controls) attrs.push('controls');
            if (autoplay) attrs.push('autoplay');
            if (loop) attrs.push('loop');
            if (muted) attrs.push('muted');

            const alignClass = align ? ` align-${align}` : '';

            return `<div class="myst-video-container${alignClass}"><video src="${videoPath}" style="${styleAttrs.join(' ')}" ${attrs.join(' ')} preload="metadata">Your browser does not support the video tag.</video>${bodyContent ? `<div class="video-caption">${bodyContent}</div>` : ''}</div>`;
        }

        // video-compare directive for side-by-side video comparisons
        case 'video-compare': {
            const labelOpt = optionLines.find(o => o.startsWith(':label:'));
            const label = labelOpt ? labelOpt.replace(/^:label:\s*/, '').trim() : '';
            const idAttr = label ? ` id="${label}"` : '';
            const leftOpt = optionLines.find(o => o.startsWith(':left:'));
            const rightOpt = optionLines.find(o => o.startsWith(':right:'));
            const leftLabelOpt = optionLines.find(o => o.startsWith(':left-label:'));
            const rightLabelOpt = optionLines.find(o => o.startsWith(':right-label:'));

            const leftVideo = leftOpt ? leftOpt.replace(/^:left:\s*/, '').trim() : '';
            const rightVideo = rightOpt ? rightOpt.replace(/^:right:\s*/, '').trim() : '';
            const leftLabel = leftLabelOpt ? leftLabelOpt.replace(/^:left-label:\s*/, '').trim() : 'Left';
            const rightLabel = rightLabelOpt ? rightLabelOpt.replace(/^:right-label:\s*/, '').trim() : 'Right';

            return `<div class="video-compare"${idAttr}>
            <div class="video-compare-container">
                <div class="video-compare-left">
                    <div class="video-compare-label">${leftLabel}</div>
                    <video controls preload="metadata">
                        <source src="${leftVideo}" type="video/mp4">
                    </video>
                </div>
                <div class="video-compare-right">
                    <div class="video-compare-label">${rightLabel}</div>
                    <video controls preload="metadata">
                        <source src="${rightVideo}" type="video/mp4">
                    </video>
                </div>
            </div>
            <div class="video-compare-caption">${bodyContent}</div>
        </div>`;
        }

        // Exercise directive
        case 'exercise': {
            const labelOpt = optionLines.find(o => o.startsWith(':label:'));
            const label = labelOpt ? labelOpt.replace(/^:label:\s*/, '').trim() : '';
            const idAttr = label ? ` id="${label}"` : '';
            const classOpt = optionLines.find(o => o.startsWith(':class:'));
            const extraClass = classOpt ? classOpt.replace(/^:class:\s*/, '').trim() : '';
            const isDropdown = extraClass.includes('dropdown');
            const exerciseTitle = titleArg || 'Exercise';

            if (isDropdown) {
                return `<div class="exercise-block${extraClass ? ' ' + extraClass : ''}"${idAttr}>
                <details class="exercise-dropdown">
                    <summary class="exercise-title">${exerciseTitle}</summary>
                    <div class="exercise-content">\n\n${bodyContent}\n\n</div>
                </details>
            </div>`;
            }

            return `<div class="exercise-block${extraClass ? ' ' + extraClass : ''}"${idAttr}>
            <div class="exercise-title">${exerciseTitle}</div>
            <div class="exercise-content">\n\n${bodyContent}\n\n</div>
        </div>`;
        }

        // Solution directive
        case 'solution': {
            const linkedExercise = titleArg; // The argument is the label of the linked exercise
            const labelOpt = optionLines.find(o => o.startsWith(':label:'));
            const label = labelOpt ? labelOpt.replace(/^:label:\s*/, '').trim() : '';
            const idAttr = label ? ` id="${label}"` : '';
            const classOpt = optionLines.find(o => o.startsWith(':class:'));
            const extraClass = classOpt ? classOpt.replace(/^:class:\s*/, '').trim() : '';
            const isDropdown = extraClass.includes('dropdown');
            const solutionTitle = linkedExercise ? `Solution to ${linkedExercise}` : 'Solution';

            if (isDropdown) {
                return `<div class="solution-block${extraClass ? ' ' + extraClass : ''}"${idAttr} data-exercise="${linkedExercise}">
                <details class="solution-dropdown">
                    <summary class="solution-title">${solutionTitle}</summary>
                    <div class="solution-content">\n\n${bodyContent}\n\n</div>
                </details>
            </div>`;
            }

            return `<div class="solution-block${extraClass ? ' ' + extraClass : ''}"${idAttr} data-exercise="${linkedExercise}">
            <div class="solution-title">${solutionTitle}</div>
            <div class="solution-content">\n\n${bodyContent}\n\n</div>
        </div>`;
        }

        // Code and code-block directives
        case 'code':
        case 'code-block': {
            const language = titleArg || 'text';
            const labelOpt = optionLines.find(o => o.startsWith(':label:'));
            const label = labelOpt ? labelOpt.replace(/^:label:\s*/, '').trim() : '';
            const idAttr = label ? ` id="${label}"` : '';
            const captionOpt = optionLines.find(o => o.startsWith(':caption:'));
            const caption = captionOpt ? captionOpt.replace(/^:caption:\s*/, '').trim() : '';
            const filenameOpt = optionLines.find(o => o.startsWith(':filename:'));
            const filename = filenameOpt ? filenameOpt.replace(/^:filename:\s*/, '').trim() : '';
            // Handle :linenos: with or without value (true, false, or just :linenos:)
            const linenosOpt = optionLines.find(o => o.match(/^:linenos:/));
            const showLinenos = linenosOpt ? !linenosOpt.includes('false') : false;
            const linenoStartOpt = optionLines.find(o => o.startsWith(':lineno-start:'));
            const linenoStart = linenoStartOpt ? parseInt(linenoStartOpt.replace(/^:lineno-start:\s*/, '').trim()) || 1 : 1;

            // Return markdown code block with wrapper - remark will handle syntax highlighting
            const linenosClass = showLinenos ? ' line-numbers' : '';
            const dataStart = showLinenos && linenoStart !== 1 ? ` data-start="${linenoStart}"` : '';

            let result = `<div class="code-block-container${linenosClass}"${idAttr}${dataStart}>`;
            if (filename) {
                result += `<div class="code-filename">${escapeHtml(filename)}</div>`;
            }
            // Output as markdown code fence for remark to process with syntax highlighting
            result += `\n\n\`\`\`${language}\n${bodyContent}\n\`\`\`\n\n`;
            if (caption) {
                result += `<div class="code-caption">${caption}</div>`;
            }
            result += '</div>';
            return result;
        }

        // Mermaid diagram directive
        case 'mermaid': {
            const labelOpt = optionLines.find(o => o.startsWith(':label:'));
            const label = labelOpt ? labelOpt.replace(/^:label:\s*/, '').trim() : '';
            const idAttr = label ? ` id="${label}"` : '';
            const captionOpt = optionLines.find(o => o.startsWith(':caption:'));
            const caption = captionOpt ? captionOpt.replace(/^:caption:\s*/, '').trim() : '';

            // Encode content as base64 to preserve it exactly through HTML parsing
            const base64Content = Buffer.from(bodyContent).toString('base64');

            let result = `<div class="mermaid-container"${idAttr}>`;
            result += `<pre class="mermaid" data-code="${base64Content}"></pre>`;
            if (caption) {
                result += `<div class="mermaid-caption">${caption}</div>`;
            }
            result += '</div>';
            return result;
        }

        // Glossary directive
        case 'glossary': {
            // MyST glossary is a list of terms and definitions.
            // Simplified parsing: 
            // Term
            //   Indented definition

            const lines = bodyContent.split('\n');
            let html = '<dl class="myst-glossary">';
            let currentTerm = '';

            lines.forEach(line => {
                if (!line.trim()) return;

                if (line.match(/^:\s+/) || line.startsWith(' ') || line.startsWith('\t')) {
                    // It's a definition (starts with colon+space OR indentation)
                    if (currentTerm) {
                        const defText = line.replace(/^:\s+/, '').trim();
                        html += `<dd>${defText}</dd>`;
                    }
                } else {
                    // It's a term
                    currentTerm = line.trim();
                    // Create an ID for linking
                    const id = 'term-' + currentTerm.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                    html += `<dt id="${id}">${currentTerm}</dt>`;
                }
            });

            html += '</dl>';
            return html;
        }

        default:
            return `<div class="myst-${name}">\n\n${bodyContent}\n\n</div>`;
    }
}

/**
 * Parse MyST role syntax like {button}`text <url>`
 */
function parseMystRoles(content: string): string {
    let result = content;

    // Button role: {button}`Text <url>`
    result = result.replace(/\{button\}`([^<`]+)(?:\s*<([^>]+)>)?`/g, (_match, text, url) => {
        const href = url || '#';
        return `<a href="${href}" class="btn" role="button">${text.trim()}</a>`;
    });

    // Term role: {term}`Text` or {term}`Text <Actual Term>`
    result = result.replace(/\{term\}`([^`<]+)(?:\s*<([^>]+)>)?`/g, (_match, text, term) => {
        const displayText = text.trim();
        const termTarget = term ? term.trim() : displayText;
        const id = 'term-' + termTarget.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        return `<a href="#${id}" class="myst-term" title="Term: ${termTarget}">${displayText}</a>`;
    });

    // Typography roles
    // {sub}`text` -> <sub>text</sub>
    result = result.replace(/\{sub\}`([^`]+)`/g, '<sub>$1</sub>');

    // {sup}`text` -> <sup>text</sup>
    result = result.replace(/\{sup\}`([^`]+)`/g, '<sup>$1</sup>');

    // {kbd}`text` -> <kbd>text</kbd>
    result = result.replace(/\{kbd\}`([^`]+)`/g, '<kbd>$1</kbd>');

    // {abbr}`text` -> <abbr>text</abbr> - simplified, proper abbr often needs title {abbr}`HTML (HyperText Markup Language)`
    // Support {abbr}`PageRank (Page Rank)` format -> <abbr title="Page Rank">PageRank</abbr>
    result = result.replace(/\{abbr\}`([^`(]+)(?:\s*\(([^)]+)\))?`/g, (_match, text, title) => {
        const titleAttr = title ? ` title="${title.trim()}"` : '';
        return `<abbr${titleAttr}>${text.trim()}</abbr>`;
    });

    // {del}`text` -> <del>text</del>
    result = result.replace(/\{del\}`([^`]+)`/g, '<del>$1</del>');

    // {u}`text` -> <u>text</u> (underline)
    result = result.replace(/\{u\}`([^`]+)`/g, '<u>$1</u>');

    // {sc}`text` -> <span style="font-variant: small-caps;">text</span>
    result = result.replace(/\{sc\}`([^`]+)`/g, '<span style="font-variant: small-caps;">$1</span>');

    // Subscript: {sub}`text` or {subscript}`text`
    result = result.replace(/\{(?:sub|subscript)\}`([^`]+)`/g, (_match, text) => {
        return `<sub>${text}</sub>`;
    });

    // Superscript: {sup}`text` or {superscript}`text`
    result = result.replace(/\{(?:sup|superscript)\}`([^`]+)`/g, (_match, text) => {
        return `<sup>${text}</sup>`;
    });

    // Keyboard: {kbd}`Ctrl+C` or {keyboard}`text`
    result = result.replace(/\{(?:kbd|keyboard)\}`([^`]+)`/g, (_match, text) => {
        // Split by + to style each key separately
        const keys = text.split('+').map((k: string) => `<kbd>${k.trim()}</kbd>`);
        return keys.join(' + ');
    });

    // Abbreviation: {abbr}`HR (Heart Rate)`
    result = result.replace(/\{abbr\}`([^(]+)\(([^)]+)\)`/g, (_match, abbr, title) => {
        return `<abbr title="${title.trim()}">${abbr.trim()}</abbr>`;
    });

    // Strikethrough/Delete: {del}`text` or {strike}`text`
    result = result.replace(/\{(?:del|strike)\}`([^`]+)`/g, (_match, text) => {
        return `<del>${text}</del>`;
    });

    // Underline: {u}`text` or {underline}`text`
    result = result.replace(/\{(?:u|underline)\}`([^`]+)`/g, (_match, text) => {
        return `<u>${text}</u>`;
    });

    // Small caps: {sc}`text` or {smallcaps}`text`
    result = result.replace(/\{(?:sc|smallcaps)\}`([^`]+)`/g, (_match, text) => {
        return `<span class="smallcaps">${text}</span>`;
    });

    return result;
}

/**
 * Render markdown content to HTML
 */
export async function renderMarkdownContent(rawContent: string, category: string, slug: string): Promise<string> {
    const { data, content } = matter(rawContent);
    let result = content;

    // Process abbreviations from frontmatter
    if (data.abbreviations && typeof data.abbreviations === 'object') {
        Object.entries(data.abbreviations).forEach(([abbr, fullText]) => {
            // Use word boundary to avoid replacing inside other words
            // Escape special regex characters in the abbreviation
            const escapedAbbr = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedAbbr}\\b`, 'g');
            // Check if it's already inside an HTML tag or attribute (basic check)
            // This is a simplified replacement that assumes plain text context mostly
            result = result.replace(regex, `<abbr title="${fullText}">${abbr}</abbr>`);
        });
    }

    result = parseMystMath(result);
    result = parseMystFigures(result);
    result = parseMystDirectives(result);
    result = parseMystRoles(result);

    const processedContent = await remark()
        .use(remarkGfm)
        .use(remarkRehype, { allowDangerousHtml: true })

        .use(rehypeStringify, { allowDangerousHtml: true })
        .process(result);

    const htmlContent = String(processedContent)
        .replace(/<table/g, '<div class="table-wrapper"><table')
        .replace(/<\/table>/g, '</table></div>');

    // In production, use GitHub raw URLs for images
    const isDev = import.meta.env.DEV;
    const gitHubBase = 'https://raw.githubusercontent.com/ROCm/rocm-blogs/release';
    const baseImageUrl = isDev
        ? `/blogs/${category}/${slug}/images/`
        : `${gitHubBase}/blogs/${category}/${slug}/images/`;
    const baseImageUrlSingular = isDev
        ? `/blogs/${category}/${slug}/image/`
        : `${gitHubBase}/blogs/${category}/${slug}/image/`;
    const sharedImagesUrl = isDev
        ? `/blogs/images/`
        : `${gitHubBase}/blogs/images/`;
    const processedHtml = htmlContent
        .replace(/src="\.\/images\//g, `src="${baseImageUrl}`)
        .replace(/src="images\//g, `src="${baseImageUrl}`)
        .replace(/src="\.\/image\//g, `src="${baseImageUrlSingular}`)
        .replace(/src="image\//g, `src="${baseImageUrlSingular}`)
        .replace(/src="\.\.\/images\//g, `src="${sharedImagesUrl}`)
        // Video path rewriting
        .replace(/src="\.\/videos\//g, `src="${baseImageUrl.replace('/images/', '/videos/')}`)
        .replace(/src="videos\//g, `src="${baseImageUrl.replace('/images/', '/videos/')}`);

    return processedHtml;
}

/**
 * Rewrite all image URLs in HTML to use GitHub raw URLs in production.
 * This handles cases where images have already been resolved to /blogs/... paths.
 */
export function rewriteImageUrlsForProduction(html: string): string {
    const isDev = import.meta.env.DEV;
    if (isDev) return html; // No rewriting needed in development

    const gitHubBase = 'https://raw.githubusercontent.com/ROCm/rocm-blogs/release';

    // Rewrite all src="/blogs/..." to src="https://raw.githubusercontent.com/..."
    return html.replace(/src="\/blogs\//g, `src="${gitHubBase}/blogs/`);
}

export function formatDate(dateStr: string): string {
    if (!dateStr) return '';

    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;

        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch {
        return dateStr;
    }
}

export function getCategoryDisplayName(categoryId: string): string {
    const categoryMap: Record<string, string> = {
        'artificial-intelligence': 'Applications & Models',
        'ecosystems-and-partners': 'Ecosystems & Partners',
        'high-performance-computing': 'High Performance Computing',
        'software-tools-optimization': 'Software Tools & Optimizations'
    };
    return categoryMap[categoryId] || categoryId;
}

/**
 * Tokenize text into words for similarity comparison
 */
export function tokenize(text: string): string[] {
    // Remove HTML tags, special characters, and normalize
    const cleaned = text
        .toLowerCase()
        .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
        .replace(/[^a-z0-9\s]/g, ' ')  // Remove special chars
        .replace(/\s+/g, ' ')  // Normalize whitespace
        .trim();

    // Common stop words to filter out
    const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
        'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
        'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these',
        'those', 'it', 'its', 'as', 'if', 'when', 'than', 'so', 'such', 'no',
        'not', 'only', 'same', 'also', 'into', 'our', 'we', 'you', 'your',
        'their', 'them', 'they', 'he', 'she', 'his', 'her', 'which', 'what',
        'who', 'whom', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
        'most', 'other', 'some', 'any', 'about', 'between', 'through', 'during',
        'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over',
        'under', 'again', 'further', 'then', 'once', 'here', 'there', 'where',
        'why', 'just', 'now', 'very', 'even', 'well', 'back', 'still', 'way'
    ]);

    return cleaned.split(' ').filter(word => word.length > 2 && !stopWords.has(word));
}

/**
 * Calculate term frequency for a list of tokens
 */
export function calculateTF(tokens: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    for (const token of tokens) {
        tf.set(token, (tf.get(token) || 0) + 1);
    }
    // Normalize by document length
    const length = tokens.length;
    for (const [term, count] of tf) {
        tf.set(term, count / length);
    }
    return tf;
}

/**
 * Calculate cosine similarity between two TF vectors
 */
export function cosineSimilarity(tf1: Map<string, number>, tf2: Map<string, number>): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    // Get all unique terms
    const allTerms = new Set([...tf1.keys(), ...tf2.keys()]);

    for (const term of allTerms) {
        const v1 = tf1.get(term) || 0;
        const v2 = tf2.get(term) || 0;
        dotProduct += v1 * v2;
        norm1 += v1 * v1;
        norm2 += v2 * v2;
    }

    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * Calculate text similarity between two strings using cosine similarity
 */
export function textSimilarity(text1: string, text2: string): number {
    const tokens1 = tokenize(text1);
    const tokens2 = tokenize(text2);
    const tf1 = calculateTF(tokens1);
    const tf2 = calculateTF(tokens2);
    return cosineSimilarity(tf1, tf2);
}
