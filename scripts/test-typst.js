
const equations = {};
let eqCounter = 0;

function parseMystMath(content) {
    let result = content;

    // Parse ```{math} ... ``` directives
    result = result.replace(/```\{math\}\s*\n([\s\S]*?)```/g, (_, fullBody) => {
        const lines = fullBody.split('\n');
        let options = {};
        let mathLines = [];

        for (const line of lines) {
            const trimmed = line.trim();
            // Match :key: value
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

        // Unlabeled
        return `<div class="equation-block">` +
            '\\[' + mathContent + '\\]' +
            '</div>';
    });

    return result;
}

const input = `
\`\`\`{math}
:typst: root(3, x)
:label: cube-root
\\sqrt[3]{x}
\`\`\`
`;

console.log("Input:", input);
const output = parseMystMath(input);
console.log("Output:", output);

if (!output.includes('typst') && output.includes('\\sqrt[3]{x}') && output.includes('id="cube-root"')) {
    console.log("SUCCESS: Typst option stripped and label preserved.");
} else {
    console.log("FAIL: Typst option leaked or label lost.");
}
