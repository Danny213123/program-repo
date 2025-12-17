import { useState } from 'react';
import { MySTRenderer } from 'myst-demo';
import './DevPage.css';

const DEFAULT_MARKDOWN = `# MyST Math Examples

## Dollar Math with Labels

$$
(a + b)^2 = a^2 + 2ab + b^2
$$ (mymath2)

The equation {eq}\`mymath2\` is a quadratic equation.

## Math Role (Inline)

Since Pythagoras, we know that {math}\`a^2 + b^2 = c^2\`.

## Math Directive

\`\`\`{math}
:label: mymath
w_{t+1} = (1 + r_{t+1}) s(w_t) + y_{t+1}
\`\`\`

The equation {eq}\`mymath\` is also referenced.

## AMS Environments

\\begin{gather*}
a_1=b_1+c_1\\\\
a_2=b_2+c_2-d_2+e_2
\\end{gather*}

\\begin{align}
a_{11}& =b_{11}&
  a_{12}& =b_{12}\\\\
a_{21}& =b_{21}&
  a_{22}& =b_{22}+c_{22}
\\end{align}

## Regular Inline Math

Regular inline: $E = mc^2$

## Admonition

:::{note}
This is a note admonition with some **bold** text.
:::
`;

export function DevPage() {
    const [markdown, setMarkdown] = useState(DEFAULT_MARKDOWN);

    return (
        <div className="dev-page">
            <div className="dev-header">
                <h1>MyST Markdown Developer</h1>
                <p>Using official myst-demo renderer</p>
            </div>
            <div className="dev-container">
                <div className="dev-editor-panel">
                    <div className="dev-panel-header">
                        <span>Markdown Input</span>
                        <button className="dev-clear-btn" onClick={() => setMarkdown('')}>Clear</button>
                    </div>
                    <textarea
                        className="dev-editor"
                        value={markdown}
                        onChange={(e) => setMarkdown(e.target.value)}
                        placeholder="Paste your MyST markdown here..."
                        spellCheck={false}
                    />
                </div>
                <div className="dev-preview-panel">
                    <div className="dev-panel-header">
                        <span>Rendered Output</span>
                    </div>
                    <div className="dev-preview myst-content">
                        <MySTRenderer value={markdown} />
                    </div>
                </div>
            </div>
        </div>
    );
}
