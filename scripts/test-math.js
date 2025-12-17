
const equations = {};
let eqCounter = 0;

function escapeMath(math) {
    return math.replace(/\\/g, '\\\\');
}

function parseMystMath(content) {
    let result = content;

    // Parse math directive: ```{math}\n:label: name\ncontent\n```
    // Test the regex from markdown.ts
    // /```\{math\}\s*\n:label:\s*(\S+)\s*\n([\s\S]*?)```/g

    result = result.replace(/```\{math\}\s*\n:label:\s*(\S+)\s*\n([\s\S]*?)```/g, (_, label, mathContent) => {
        eqCounter++;
        equations[label] = { number: eqCounter, id: label };
        console.log(`Matched Equation: ${label}`);
        return '<div class="equation-block" id="' + label + '">' +
            '\\\\[' + escapeMath(mathContent.trim()) + '\\\\]' +
            '<span class="equation-number">(' + eqCounter + ')</span>' +
            '</div>';
    });

    return result;
}

const userContent = `
\`\`\`{math}
:label: my-equation
w_{t+1} = (1 + r_{t+1}) s(w_t) + y_{t+1}
\`\`\`
`.trim();

console.log("Input:");
console.log(userContent);
const output = parseMystMath(userContent);
console.log("\nOutput:");
console.log(output);

if (output.includes('class="equation-block"')) {
    console.log("\nSUCCESS: Equation parsed.");
} else {
    console.log("\nFAILURE: Equation NOT parsed.");
}
