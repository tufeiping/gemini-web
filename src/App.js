import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { InlineMath, BlockMath } from 'react-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import Swal from 'sweetalert2';
import remarkGfm from 'remark-gfm'; // 引入 remark-gfm
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs'; // 导入 docco 样式
import rehypeSanitize from 'rehype-sanitize'; // 导入 rehype-sanitize
import ErrorBoundary from './components/ErrorBoundary'; // 引入 ErrorBoundary

import { API_KEY_DEFINE, MODEL_DEFINE, CHAT_HISTORY_LIST_DEFINE, DEFAULT_LIST_NAME, DEFAULT_LIST_SELECTED_NAME, EMPTY_HISTORY_LIST, MODEL_LIST_DEFINE, CHAT_CONTEXT_LIST_DEFINE, CHAT_CONTEXT_DEFAULT } from './Config';

import 'katex/dist/katex.min.css';
import 'sweetalert2/dist/sweetalert2.min.css';
import './App.css';


function App() {
    const [apiKey, setApiKey] = useState(() =>
        localStorage.getItem(API_KEY_DEFINE) || process.env.REACT_APP_DEFAULT_API_KEY || ''
    );
    const [model, setModel] = useState(() => localStorage.getItem(MODEL_DEFINE) || MODEL_LIST_DEFINE[0].key);
    const [currentListName, setCurrentList] = useState(() => localStorage.getItem(DEFAULT_LIST_NAME) || DEFAULT_LIST_SELECTED_NAME); // 当前列表
    const [input, setInput] = useState('');
    const [contextLength, setContextLength] = useState(() => localStorage.getItem(CHAT_CONTEXT_DEFAULT) || 6);
    const [messages, setMessages] = useState(() => {
        const histories = JSON.parse(localStorage.getItem(CHAT_HISTORY_LIST_DEFINE)) || [];
        try {
            // if history is not array, then return []
            if (!Array.isArray(histories)) {
                // reset history
                localStorage.setItem(CHAT_HISTORY_LIST_DEFINE, JSON.stringify(EMPTY_HISTORY_LIST));
                return [];
            }
            const savedMessages = histories.find(item => item.name === currentListName);
            if (savedMessages && savedMessages.history) {
                try {
                    return savedMessages.history;
                } catch (error) {
                    console.error('Error parsing saved messages:', error);
                    return [];
                }
            }
        } catch (e) {
            // console.error('Error getting saved messages:', e);
        }
        return [];
    });

    const [, forceUpdate] = useState();
    const chatContainerRef = useRef(null);
    const [loading, setLoading] = useState(false); // 添加 loading 状态

    useEffect(() => {
        const histories = JSON.parse(localStorage.getItem(CHAT_HISTORY_LIST_DEFINE)) || [];
        // 找到currentList的历史记录，然后覆盖
        if (!Array.isArray(histories)) {
            localStorage.setItem(CHAT_HISTORY_LIST_DEFINE, JSON.stringify(EMPTY_HISTORY_LIST));
            return;
        }
        const currentHistory = histories.find(item => item.name === currentListName);
        if (currentHistory) {
            currentHistory.history = messages;
        } else {
            histories.push({
                'name': currentListName,
                'history': messages
            });
        }
        localStorage.setItem(CHAT_HISTORY_LIST_DEFINE, JSON.stringify(histories));
    }, [messages]);

    useEffect(() => {
        localStorage.setItem(API_KEY_DEFINE, apiKey);
    }, [apiKey]);

    useEffect(() => {
        localStorage.setItem(MODEL_DEFINE, model);
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
            setMessages(updatedMessages, () => {

            });
        }
        setInput('');

        // 获取最近6条消息作为上下文

        const recentMessages = updatedMessages.slice(0 - contextLength);
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

    const GitHubIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.001 2C6.47598 2 2.00098 6.475 2.00098 12C2.00098 16.425 4.86348 20.1625 8.83848 21.4875C9.33848 21.575 9.52598 21.275 9.52598 21.0125C9.52598 20.775 9.51348 19.9875 9.51348 19.15C7.00098 19.6125 6.35098 18.5375 6.15098 17.975C6.03848 17.6875 5.55098 16.8 5.12598 16.5625C4.77598 16.375 4.27598 15.9125 5.11348 15.9C5.90098 15.8875 6.46348 16.625 6.65098 16.925C7.55098 18.4375 8.98848 18.0125 9.56348 17.75C9.65098 17.1 9.91348 16.6625 10.201 16.4125C7.97598 16.1625 5.65098 15.3 5.65098 11.475C5.65098 10.3875 6.03848 9.4875 6.67598 8.7875C6.57598 8.5375 6.22598 7.5125 6.77598 6.1375C6.77598 6.1375 7.61348 5.875 9.52598 7.1625C10.326 6.9375 11.176 6.825 12.026 6.825C12.876 6.825 13.726 6.9375 14.526 7.1625C16.4385 5.8625 17.276 6.1375 17.276 6.1375C17.826 7.5125 17.476 8.5375 17.376 8.7875C18.0135 9.4875 18.401 10.375 18.401 11.475C18.401 15.3125 16.0635 16.1625 13.8385 16.4125C14.201 16.725 14.5135 17.325 14.5135 18.2625C14.5135 19.6 14.501 20.675 14.501 21.0125C14.501 21.275 14.6885 21.5875 15.1885 21.4875C19.259 20.1133 21.9999 16.2963 22.001 12C22.001 6.475 17.526 2 12.001 2Z"></path>
        </svg>
    );

    const NewSessionIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 21.5C12 20.1833 11.75 18.95 11.25 17.8C10.75 16.6333 10.075 15.625 9.225 14.775C8.375 13.925 7.36667 13.25 6.2 12.75C5.05 12.25 3.81667 12 2.5 12C3.81667 12 5.05 11.75 6.2 11.25C7.36667 10.75 8.375 10.075 9.225 9.225C10.075 8.375 10.75 7.375 11.25 6.225C11.75 5.05833 12 3.81667 12 2.5C12 3.81667 12.25 5.05833 12.75 6.225C13.25 7.375 13.925 8.375 14.775 9.225C15.625 10.075 16.625 10.75 17.775 11.25C18.9417 11.75 20.1833 12 21.5 12C20.1833 12 18.9417 12.25 17.775 12.75C16.625 13.25 15.625 13.925 14.775 14.775C13.925 15.625 13.25 16.6333 12.75 17.8C12.25 18.95 12 20.1833 12 21.5Z" className="sparkle" />
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
                localStorage.removeItem(CHAT_HISTORY_LIST_DEFINE);
                Swal.fire(
                    '已清空!',
                    '所有历史记录已被删除。',
                    'success'
                );
            }
        });
    };

    const exportHistory = () => {
        const historyData = localStorage.getItem(CHAT_HISTORY_LIST_DEFINE); // 从 localStorage 获取历史记录
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
        a.download = `gemini_chat_history_${currentListName}.json`; // 设置下载文件名
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
                    localStorage.setItem(CHAT_HISTORY_LIST_DEFINE, JSON.stringify(importedMessages));
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

    const getNamedChatHistory = (name) => {
        const allLists = JSON.parse(localStorage.getItem(CHAT_HISTORY_LIST_DEFINE)) || EMPTY_HISTORY_LIST;
        return allLists.find(item => item.name === name);
    };

    const startNewSession = () => {
        Swal.fire({
            title: '启用新会话?',
            text: '启用新的会话会开启新的默认会话，您可以在设置中先保存当前会话内容然后再启用新会话。',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: '是,启用新会话',
            cancelButtonText: '取消'
        }).then((result) => {
            if (result.isConfirmed) {
                setMessages([]);
                // 获取之前所有会话，并新增一个default的会话，如果之前有default会话，直接覆盖
                const allLists = JSON.parse(localStorage.getItem(CHAT_HISTORY_LIST_DEFINE)) || EMPTY_HISTORY_LIST;
                // 如果有default会话，直接覆盖，否则新增
                const defaultHistory = allLists.find(item => item.name === DEFAULT_LIST_SELECTED_NAME);
                if (defaultHistory) {
                    defaultHistory.history = [];
                } else {
                    allLists.push(EMPTY_HISTORY_LIST);
                }
                fireSetCurrentList(DEFAULT_LIST_SELECTED_NAME);
                localStorage.setItem(CHAT_HISTORY_LIST_DEFINE, JSON.stringify(allLists));
                Swal.fire(
                    '已启用新会话',
                    '所有历史记录已被清除。',
                    'success'
                );
            }
        });
    };

    const SettingsContent = ({ apiKey, model }) => {
        return (
            <div className="settings-container">
                <div className="setting-item">
                    <label htmlFor="apiKey">API Key:</label>
                    <input
                        type="text"
                        id="apiKey"
                        defaultValue={apiKey}
                        className="swal2-input"
                        style={{ margin: 0, fontSize: '0.8em', height: '30px' }}
                    />
                </div>
                <div className="setting-item">
                    <label htmlFor="model">选择模型:</label>
                    <select
                        id="model"
                        className="swal2-input"
                        defaultValue={model}
                        style={{ fontSize: '0.8em', height: '30px', padding: '2px' }}
                    >
                        {MODEL_LIST_DEFINE.map((model, index) => (
                            <option key={index} value={model.key} selected={model.key === model}>{model.value}</option>
                        ))}
                    </select>
                </div>
                <div className="setting-item">
                    <button id="importBtn" className="swal2-confirm swal2-styled">📥 导入历史记录</button>
                    <button id="exportBtn" className="swal2-confirm swal2-styled">📤 导出历史记录</button>
                    <button id="clearBtn" className="swal2-confirm swal2-styled">🗑 删除历史记录</button>
                </div>
                <div className="setting-item">
                    <label htmlFor="maxTokens">关联上下文(影响tokens用量):</label>
                    <select id="context-length" defaultValue={contextLength}>
                        {CHAT_CONTEXT_LIST_DEFINE.map((item, index) => {
                            return (
                                <option key={index} value={item.key} selected={item.key === contextLength}>{item.value}</option>
                            );
                        })}
                    </select>
                </div>
                <div className="setting-item">
                    <p>本Chat项目所有的信息均保存在本地，没有服务端存储。<div className="github-link"><span className="github-icon"><GitHubIcon /></span>代码仓库地址: <a href="https://github.com/tufeiping/gemini-web" target="_blank" rel="noopener noreferrer">https://github.com/tufeiping/gemini-web</a></div></p>
                    <p>没有API Key的可以到<a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Google Cloud Console</a>申请</p>
                </div>
            </div>
        );
    };

    const handleSettingsClick = () => {
        const settingsElement = document.createElement('div');
        ReactDOM.render(<SettingsContent apiKey={apiKey} model={model} />, settingsElement);

        Swal.fire({
            title: '设置',
            html: settingsElement,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: '保存',
            cancelButtonText: '取消',
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
                const newContextLength = document.getElementById('context-length').value;
                setApiKey(newApiKey);
                setModel(newModel);
                setContextLength(newContextLength);
                localStorage.setItem(API_KEY_DEFINE, newApiKey);
                localStorage.setItem(MODEL_DEFINE, newModel);
                localStorage.setItem(CHAT_CONTEXT_DEFAULT, newContextLength);
            }
        });
    };

    const fireSetCurrentList = (name) => {
        setCurrentList(name);
        localStorage.setItem(DEFAULT_LIST_NAME, name);
    }

    return (
        <div className="App">
            <header>
                <div className="title-container">
                    <img src="/ai_studio_favicon_16x16.ico" alt="Gemini Chat Logo" className="app-logo" onClick={() => {
                        // 弹出下拉列表，从localStorage中读取所有geminiChatAppHistory_v1，作为列表显示，并取出名称作为当前会话标题
                        const allLists = (JSON.parse(localStorage.getItem(CHAT_HISTORY_LIST_DEFINE)) || EMPTY_HISTORY_LIST).map(item => item.name);
                        let selectedName = allLists[0]; // 默认选中第一个
                        Swal.fire({
                            title: '选择一个会话',
                            input: 'select',
                            inputOptions: allLists,
                            showDenyButton: true,
                            confirmButtonText: '选择',
                            denyButtonText: '删除此会话',
                            didOpen: (modal) => {
                                const select = modal.querySelector('select');
                                select.addEventListener('change', (e) => {
                                    selectedName = allLists[e.target.value]; // 直接保存名称而不是索引
                                });
                                selectedName = allLists[select.value]; // 初始化选中值
                            }
                        }).then((result) => {
                            if (result.isConfirmed) {
                                const idx = parseInt(result.value);
                                const name = allLists[idx];
                                fireSetCurrentList(name);
                                const history = getNamedChatHistory(name);
                                if (history) {
                                    setMessages(history.history);
                                }
                            } else if (result.isDenied) {
                                // 使用保存的名称而不是尝试从DOM中获取
                                Swal.fire({
                                    title: '确认删除',
                                    text: `确定要删除会话 "${selectedName}" 吗？`,
                                    icon: 'warning',
                                    showCancelButton: true,
                                    confirmButtonText: '确定删除',
                                    cancelButtonText: '取消'
                                }).then((confirmResult) => {
                                    if (confirmResult.isConfirmed) {
                                        // 从localStorage中删除选中的会话
                                        const histories = JSON.parse(localStorage.getItem(CHAT_HISTORY_LIST_DEFINE)) || [];
                                        const updatedHistories = histories.filter(item => item.name !== selectedName);
                                        localStorage.setItem(CHAT_HISTORY_LIST_DEFINE, JSON.stringify(updatedHistories));

                                        // 如果删除的是当前会话，切换到default会话
                                        if (selectedName === currentListName) {
                                            fireSetCurrentList('default');
                                            const defaultHistory = getNamedChatHistory('default');
                                            setMessages(defaultHistory ? defaultHistory.history : []);
                                        }

                                        Swal.fire('已删除', `会话 "${selectedName}" 已被删除`, 'success');
                                    }
                                });
                            }
                        });
                    }} />
                    {/* 添加一个当前对话的标题，宽度自适应，点击后可以编辑标题 */}
                    <input type="text" value={currentListName} onChange={(e) => { fireSetCurrentList(e.target.value) }} onBlur={(e) => {
                        fireSetCurrentList(e.target.value);
                        // 更新localStorage
                        const histories = JSON.parse(localStorage.getItem(CHAT_HISTORY_LIST_DEFINE)) || [];
                        const currentHistory = histories.find(item => item.name === currentListName);
                        if (currentHistory) {
                            currentHistory.history = messages;
                        } else {
                            histories.push({
                                'name': currentListName,
                                'history': messages
                            });
                        }
                        localStorage.setItem(CHAT_HISTORY_LIST_DEFINE, JSON.stringify(histories));
                    }} className="current-session-title" />
                </div>
                <div className="header-buttons">
                    <button onClick={startNewSession} className="new-session-button">
                        <NewSessionIcon />
                        新会话
                    </button>
                    <button onClick={handleSettingsClick} className="settings-button">
                        🛠️ 设置
                    </button>
                </div>
            </header>
            <div className="chat-container" ref={chatContainerRef}>
                {messages.length === 0 ? (
                    <div className="empty-chat">
                        <img src="/outline.svg" alt="No messages" className="empty-chat-icon" />
                        <p>还没有任何消息</p>
                        <p className="empty-chat-hint">开始新的对话吧!</p>
                    </div>
                ) : (
                    messages.map((message, index) => (
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
                    ))
                )}
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
