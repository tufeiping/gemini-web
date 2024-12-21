/**
 * MsgDisplay 组件
 * 用于显示消息内容，支持 Markdown 渲染和数学公式。
 * 作者：Sunny
 */

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { InlineMath, BlockMath } from 'react-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs'; // 导入 docco 样式
import rehypeSanitize from 'rehype-sanitize'; 
import remarkGfm from 'remark-gfm'; 

import 'katex/dist/katex.min.css';

export default function MsgDisplay(message) {
    const messageContent = typeof message === 'string' ? message : (message.message ? message.message : '');
    const renderers = {
        math: ({ value }) => (
            <span className="math-block">
                <BlockMath math={value} />
            </span>
        ),
        inlineMath: ({ value }) => <InlineMath math={value} />,
        paragraph: ({ children }) => {
            // 检查是否只包含一个数学块
            if (children.length === 1 && children[0].type === 'span' && children[0].props.className === 'math-block') {
                return children;
            }
            return <p>{children}</p>;
        },
        code: ({ node, inline, className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            return !inline && match ? (
                <SyntaxHighlighter
                    language={language}
                    style={docco}
                    customStyle={{
                        fontSize: '0.9em',
                        padding: '1em',
                    }}
                    {...props}
                >
                    {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
            ) : (
                <code className={`inline-code ${className || ''}`} {...props}>
                    {children}
                </code>
            );
        },
    };

    return (
        <ReactMarkdown
            remarkPlugins={[remarkMath, remarkGfm]}
            rehypePlugins={[rehypeKatex, rehypeSanitize]}
            components={renderers}
        >
            {messageContent}
        </ReactMarkdown>
    );
};
