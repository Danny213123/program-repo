
const equations = {};
let eqCounter = 0;

function parseMystMath(content) {
    let result = content;

    // Helper (mock)
    const escapeMath = (m) => m;

    // Parse :::math directive
    result = result.replace(/:::\{math\}\s*\n([\s\S]*?):::/g, (_, content) => {
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
        } else if (enumerated) {
            // Default: unnumbered if no label
            return `<div class="equation-block">` +
                '\\[' + mathContent + '\\]' +
                '</div>';
        }

        // enumerated: false
        return `<div class="equation-block">` +
            '\\[' + mathContent + '\\]' +
            '</div>';
    });

    return result;
}

const input = `
:::{math}
:enumerated: false
Ax = b
:::

:::{math}
:label: myeq
y = mx + b
:::
`;

console.log("Input:", input);
const output = parseMystMath(input);
console.log("Output:", output);

if (output.includes('id="myeq"') && output.includes('(1)')) {
    console.log("Generalized labeled block works.");
} else {
    console.log("FAIL: Labeled block failed.");
}

if (!output.includes('(2)') && output.includes('Ax = b')) {
    console.log("Enumerated false block works (no number).");
} else {
    console.log("FAIL: Enumerated false block failed.");
}
