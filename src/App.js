import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import './App.css';
import remarkGfm from 'remark-gfm'; // 引入 remark-gfm
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs'; // 导入 docco 样式
import rehypeSanitize from 'rehype-sanitize'; // 导入 rehype-sanitize
import ErrorBoundary from './components/ErrorBoundary'; // 引入 ErrorBoundary

function App() {
    const [apiKey, setApiKey] = useState(() =>
        localStorage.getItem('apiKey') || process.env.REACT_APP_DEFAULT_API_KEY || ''
    );
    const [model, setModel] = useState(() => localStorage.getItem('model') || 'gemini-1.5-flash-latest');
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState(() => {
        const savedMessages = localStorage.getItem('geminiChatAppHistory_v1');
        if (savedMessages) {
            try {
                return JSON.parse(savedMessages);
            } catch (error) {
                console.error('Error parsing saved messages:', error);
                return [];
            }
        }
        return [];
    });

    const [, forceUpdate] = useState();
    const chatContainerRef = useRef(null);
    const [loading, setLoading] = useState(false); // 添加 loading 状态

    useEffect(() => {
        localStorage.setItem('geminiChatAppHistory_v1', JSON.stringify(messages));
    }, [messages]);

    useEffect(() => {
        localStorage.setItem('apiKey', apiKey);
    }, [apiKey]);

    useEffect(() => {
        localStorage.setItem('model', model);
    }, [model]);

    const formatMessageTime = useCallback((timestamp) => {
        const now = new Date();
        const messageTime = new Date(timestamp);
        const diffInSeconds = Math.floor((now - messageTime) / 1000);

        if (diffInSeconds < 60) {
            return '刚刚';
        } else {
            return formatDistanceToNow(messageTime, { addSuffix: true, locale: zhCN });
        }
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            forceUpdate({});
        }, 60000); // 每分钟更新一次

        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSubmit = async (e, resendContent = null) => {
        e && e.preventDefault();
        const content = resendContent || input;
        if (!content.trim()) return;

        setLoading(true); // 开始 loading

        let updatedMessages;
        if (resendContent && messages[messages.length - 1].role === 'user' && messages[messages.length - 1].content === resendContent) {
            // 如果是重新发送最后一条用户消息，不添加新消息
            updatedMessages = [...messages];
        } else {
            // 否则，添加新的用户消息
            const newUserMessage = { role: 'user', content, timestamp: new Date().toISOString() };
            updatedMessages = [...messages, newUserMessage];
            setMessages(updatedMessages);
        }
        setInput('');

        // 获取最近6条消息作为上下文
        const recentMessages = updatedMessages.slice(-6);
        const context = recentMessages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [
                        ...context,
                        { role: 'user', parts: [{ text: content }] }
                    ],
                }),
            });

            const data = await response.json();
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                const aiResponse = data.candidates[0].content.parts[0].text;
                const newAiMessage = { role: 'ai', content: aiResponse, timestamp: new Date().toISOString() };
                setMessages([...updatedMessages, newAiMessage]);
            } else {
                console.error('Unexpected API response structure:', data);
                Swal.fire('错误', '获取 AI 响应失败，请重试或检查您的 API 密钥。', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            Swal.fire('错误', '发送消息时出错，请重试。', 'error');
        } finally {
            setLoading(false); // 结束 loading
        }
    };

    const resendMessage = (content) => {
        handleSubmit(null, content);
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            alert('内容已复制到剪贴板');
        });
    };

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

    const LLMAvatar = () => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="avatar llm-avatar">
            <path d="M13.5 2C13.5 2.44425 13.3069 2.84339 13 3.11805V5H18C19.6569 5 21 6.34315 21 8V18C21 19.6569 19.6569 21 18 21H6C4.34315 21 3 19.6569 3 18V8C3 6.34315 4.34315 5 6 5H11V3.11805C10.6931 2.84339 10.5 2.44425 10.5 2C10.5 1.17157 11.1716 0.5 12 0.5C12.8284 0.5 13.5 1.17157 13.5 2ZM6 7C5.44772 7 5 7.44772 5 8V18C5 18.5523 5.44772 19 6 19H18C18.5523 19 19 18.5523 19 18V8C19 7.44772 18.5523 7 18 7H13H11H6ZM2 10H0V16H2V10ZM22 10H24V16H22V10ZM9 14.5C9.82843 14.5 10.5 13.8284 10.5 13C10.5 12.1716 9.82843 11.5 9 11.5C8.17157 11.5 7.5 12.1716 7.5 13C7.5 13.8284 8.17157 14.5 9 14.5ZM15 14.5C15.8284 14.5 16.5 13.8284 16.5 13C16.5 12.1716 15.8284 11.5 15 11.5C14.1716 11.5 13.5 12.1716 13.5 13C13.5 13.8284 14.1716 14.5 15 14.5Z"></path>
        </svg>
    );

    const UserAvatar = () => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="avatar user-avatar">
            <path d="M4 22C4 17.5817 7.58172 14 12 14C16.4183 14 20 17.5817 20 22H4ZM12 13C8.685 13 6 10.315 6 7C6 3.685 8.685 1 12 1C15.315 1 18 3.685 18 7C18 10.315 15.315 13 12 13Z"></path>
        </svg>
    );

    const deleteMessage = (index) => {
        Swal.fire({
            title: '确定要删除这条消息吗?',
            text: "此操作不可撤销!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: '是,删除它',
            cancelButtonText: '取消'
        }).then((result) => {
            if (result.isConfirmed) {
                const updatedMessages = messages.filter((_, i) => i !== index);
                setMessages(updatedMessages);
                Swal.fire(
                    '已删除!',
                    '该消息已被删除。',
                    'success'
                );
            }
        });
    };

    const clearHistory = () => {
        Swal.fire({
            title: '确定要删除所有历史记录吗?',
            text: "此操作不可撤销!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: '是,删除所有',
            cancelButtonText: '取消'
        }).then((result) => {
            if (result.isConfirmed) {
                setMessages([]);
                localStorage.removeItem('geminiChatAppHistory_v1');
                Swal.fire(
                    '已清空!',
                    '所有历史记录已被删除。',
                    'success'
                );
            }
        });
    };

    const exportHistory = () => {
        const historyData = localStorage.getItem('geminiChatAppHistory_v1'); // 从 localStorage 获取历史记录
        if (!historyData) {
            Swal.fire({
                title: '无可导出的记录',
                text: '当前没有聊天记录可供导出。',
                icon: 'info',
                confirmButtonText: '确定'
            });
            return;
        }

        const blob = new Blob([historyData], { type: 'application/json' }); // 创建 Blob 对象
        const url = URL.createObjectURL(blob); // 创建 URL
        const a = document.createElement('a'); // 创建链接元素
        a.href = url;
        a.download = 'gemini_chat_history.json'; // 设置下载文件名
        document.body.appendChild(a);
        a.click(); // 触发下载
        document.body.removeChild(a); // 移除链接元素
        URL.revokeObjectURL(url); // 释放 URL

        Swal.fire({
            title: '导出成功',
            text: '聊天记录已成功导出。',
            icon: 'success',
            confirmButtonText: '确定'
        });
    };

    const importHistory = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedMessages = JSON.parse(e.target.result);
                    if (importedMessages.length === 0) {
                        Swal.fire({
                            title: '导入失败',
                            text: '导入的文件不包含任何聊天记录。',
                            icon: 'error',
                            confirmButtonText: '确定'
                        });
                        return;
                    }
                    setMessages(importedMessages);
                    localStorage.setItem('geminiChatAppHistory_v1', JSON.stringify(importedMessages));
                    Swal.fire({
                        title: '导入成功',
                        text: '历史记录已成功导入。',
                        icon: 'success',
                        confirmButtonText: '确定'
                    });
                } catch (error) {
                    console.error('Error parsing imported file:', error);
                    Swal.fire({
                        title: '导入失败',
                        text: '导入失败，请确保文件格式正确。',
                        icon: 'error',
                        confirmButtonText: '确定'
                    });
                }
            };
            reader.readAsText(file);
        }
    };

    const handleModelChange = (e) => {
        setModel(e.target.value);
    };

    const startNewSession = () => {
        Swal.fire({
            title: '启用新会话?',
            text: '启用新的会话会清除已有历史记录，您可以在设置中先保存当前会话内容然后再启用新会话。',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: '是,启用新会话',
            cancelButtonText: '取消'
        }).then((result) => {
            if (result.isConfirmed) {
                setMessages([]);
                localStorage.removeItem('geminiChatAppHistory_v1');
                Swal.fire(
                    '已启用新会话',
                    '所有历史记录已被清除。',
                    'success'
                );
            }
        });
    };

    const handleSettingsClick = () => {
        Swal.fire({
            title: '设置',
            html: `
                <div class="settings-container">
                    <div class="setting-item">
                        <label for="apiKey">API Key:</label>
                        <input type="text" id="apiKey" value="${apiKey}" class="swal2-input" style="margin: 0px;" />
                    </div>
                    <div class="setting-item">
                        <label for="model">选择模型:</label>
                        <select id="model" class="swal2-input">
                            <option value="gemini-1.5-flash-latest" ${model === 'gemini-1.5-flash-latest' ? 'selected' : ''}>Gemini 1.5 Flash (最新)</option>
                            <option value="gemini-1.0-pro" ${model === 'gemini-1.0-pro' ? 'selected' : ''}>Gemini 1.0 Pro</option>
                        </select>
                    </div>
                    <div class="setting-item">
                        <button id="importBtn" class="swal2-confirm swal2-styled">📥 导入历史记录</button>
                        <button id="exportBtn" class="swal2-confirm swal2-styled">📤 导出历史记录</button>
                        <button id="clearBtn" class="swal2-confirm swal2-styled">🗑��� 删除历史记录</button>
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: '保存',
            cancelButtonText: '取消',
            customClass: {
                popup: 'swal2-popup',
                input: 'swal2-input',
                confirmButton: 'swal2-confirm',
                cancelButton: 'swal2-cancel'
            },
            didOpen: () => {
                document.getElementById('importBtn').addEventListener('click', () => {
                    const fileInput = document.createElement('input');
                    fileInput.type = 'file';
                    fileInput.accept = '.json';
                    fileInput.onchange = (event) => importHistory(event);
                    fileInput.click();
                });
                document.getElementById('exportBtn').addEventListener('click', exportHistory);
                document.getElementById('clearBtn').addEventListener('click', clearHistory);
            },
            preConfirm: () => {
                const newApiKey = document.getElementById('apiKey').value;
                const newModel = document.getElementById('model').value;
                setApiKey(newApiKey);
                setModel(newModel);
                localStorage.setItem('apiKey', newApiKey);
                localStorage.setItem('model', newModel);
            }
        });
    };

    return (
        <div className="App">
            <header>
                <div className="title-container">
                    <img src="/ai_studio_favicon_16x16.ico" alt="Gemini Chat Logo" className="app-logo" />
                    <h1>Gemini Chat</h1>
                </div>
                <div className="header-buttons">
                    <button onClick={startNewSession} className="new-session-button">
                        <svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" viewBox="0 0 24 24" fill="none">
                            <path d="M12 21.5C12 20.1833 11.75 18.95 11.25 17.8C10.75 16.6333 10.075 15.625 9.225 14.775C8.375 13.925 7.36667 13.25 6.2 12.75C5.05 12.25 3.81667 12 2.5 12C3.81667 12 5.05 11.75 6.2 11.25C7.36667 10.75 8.375 10.075 9.225 9.225C10.075 8.375 10.75 7.375 11.25 6.225C11.75 5.05833 12 3.81667 12 2.5C12 3.81667 12.25 5.05833 12.75 6.225C13.25 7.375 13.925 8.375 14.775 9.225C15.625 10.075 16.625 10.75 17.775 11.25C18.9417 11.75 20.1833 12 21.5 12C20.1833 12 18.9417 12.25 17.775 12.75C16.625 13.25 15.625 13.925 14.775 14.775C13.925 15.625 13.25 16.6333 12.75 17.8C12.25 18.95 12 20.1833 12 21.5Z" className="sparkle" />
                        </svg>
                        新会话
                    </button>
                    <button onClick={handleSettingsClick} className="settings-button">
                        🛠️ 设置
                    </button>
                </div>
            </header>
            <div className="chat-container" ref={chatContainerRef}>
                {messages.map((message, index) => (
                    <div key={index} className={`message ${message.role}`}>
                        {message.role === 'user' ? (
                            <>
                                <UserAvatar />
                                <div className="message-content">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkMath, remarkGfm]} // 添加 remark-gfm
                                        rehypePlugins={[rehypeKatex, rehypeSanitize]} // 添加 rehype-sanitize
                                        components={renderers}
                                    >
                                        {message.content}
                                    </ReactMarkdown>
                                    <div className="message-toolbar">
                                        <div>
                                            <button onClick={() => copyToClipboard(message.content)}>复制</button>
                                            <button onClick={() => deleteMessage(index)} className="delete-button">删除</button>
                                            <button onClick={() => resendMessage(message.content)} className="resend-button">重新发送</button>
                                        </div>
                                        <span>{formatMessageTime(message.timestamp)}</span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <LLMAvatar />
                                <div className="message-content">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkMath, remarkGfm]} // 添加 remark-gfm
                                        rehypePlugins={[rehypeKatex, rehypeSanitize]} // 添加 rehype-sanitize
                                        components={renderers}
                                    >
                                        {message.content}
                                    </ReactMarkdown>
                                    <div className="message-toolbar">
                                        <div>
                                            <button onClick={() => copyToClipboard(message.content)}>复制</button>
                                            <button onClick={() => deleteMessage(index)} className="delete-button">删除</button>
                                        </div>
                                        <span>{formatMessageTime(message.timestamp)}</span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
            <form onSubmit={handleSubmit} className="input-form">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="输入您的消息..."
                    disabled={loading} // 
                />
                <button type="submit" disabled={loading}>发送</button> {/* 禁用发送按钮 */}
            </form>
            {loading && <div className="loading"></div>} {/* 显示 loading 动画 */}
        </div>
    );
}

export default function Root() {
    return (
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    );
}
