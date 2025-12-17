
const equations = {};
let eqCounter = 0;

function parseMystMath(content) {
    let result = content;

    // ... (omitting other parsers for brevity if not relevant, but let's include the $$ parsers)

    // Parse $$ ... $$ (label) - MyST dollar math with label
    result = result.replace(/\$\$\s*([\s\S]*?)\$\$\s*\(([^)]+)\)/g, (_, math, label) => {
        eqCounter++;
        equations[label] = { number: eqCounter, id: label };
        return '<div class="equation-block" id="' + label + '">' +
            '\\[' + math.trim() + '\\]' +
            '<span class="equation-number">(' + eqCounter + ')</span>' +
            '</div>';
    });

    // Parse parsing logic from Markdown.ts
    result = result.replace(/\$\$\s*([\s\S]*?)\$\$/g, (_, math) => {
        let label = '';
        const cleanMath = math.replace(/\\label\{([^}]+)\}/, (_, l) => {
            label = l;
            return `\\label{${l}}`;
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

    // Parse [](#label)
    result = result.replace(/\[\]\(#([^)]+)\)/g, (_, label) => {
        const eq = equations[label];
        if (eq) {
            return `<a href="#${label}" class="eq-ref">(${eq.number})</a>`;
        }
        return `<a href="#${label}" class="eq-ref eq-pending" data-label="${label}">(?)</a>`;
    });

    return result;
}

const input = `
$$
\\label{maxwell}
\\begin{aligned}
\\nabla \\times \\vec{e}+\\frac{\\partial \\vec{b}}{\\partial t}&=0 \\\\
\\nabla \\times \\vec{h}-\\vec{j}&=\\vec{s}\_{e}
\\end{aligned}
$$

$$ \\label{one-liner} Ax=b $$

See [](#maxwell) for enlightenment and [](#one-liner) to do things on one line!
`;

console.log("Input:", input);
const output = parseMystMath(input);
console.log("Output:", output);
console.log("Equations:", JSON.stringify(equations, null, 2));

if (output.includes('(?)')) {
    console.log("FAILURE: Found (?) pending link.");
} else {
    console.log("SUCCESS: Links resolved.");
}
