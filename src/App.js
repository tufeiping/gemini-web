import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import Swal from 'sweetalert2';
import ErrorBoundary from './components/ErrorBoundary'; 
import MsgDisplay from './components/MsgDisplay';
import { LLMAvatar, UserAvatar, GitHubIcon, NewSessionIcon } from './components/Icons';
import { copyToClipboard } from './components/utils';
import { API_KEY_DEFINE, MODEL_DEFINE, CHAT_HISTORY_LIST_DEFINE, DEFAULT_LIST_NAME, DEFAULT_LIST_SELECTED_NAME, EMPTY_HISTORY_LIST, MODEL_LIST_DEFINE, CHAT_CONTEXT_LIST_DEFINE, CHAT_CONTEXT_DEFAULT } from './Config';

import 'sweetalert2/dist/sweetalert2.min.css';
import './App.css';


function App() {
    const [apiKey, setApiKey] = useState(() =>
        localStorage.getItem(API_KEY_DEFINE) || process.env.REACT_APP_DEFAULT_API_KEY || ''
    );
    const [model, setModel] = useState(() => localStorage.getItem(MODEL_DEFINE) || MODEL_LIST_DEFINE[0].key);
    const [currentListName, setCurrentList] = useState(() => localStorage.getItem(DEFAULT_LIST_NAME) || DEFAULT_LIST_SELECTED_NAME);
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

        // 检查 messageTime 是否有效
        if (isNaN(messageTime.getTime())) {
            console.error('Invalid timestamp:', timestamp);
            return '未知时间'; // 返回一个默认值
        }

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
                // 当前主题默认设置为default
                fireSetCurrentList('default');
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
                    // 从importedMessages中获取所有对话主题
                    const allLists = importedMessages.map(item => item.name);
                    // 获取defaut或默认第一条主题
                    const defaultList = allLists[0] || DEFAULT_LIST_SELECTED_NAME;
                    // 将importedMessages设置为defaultList的history
                    let defaultHistory = importedMessages.find(item => item.name === "default");
                    setMessages(defaultHistory.history);
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
                    <div className="input-container" style={{ position: 'relative' }}>
                        <input
                            type="password"
                            id="apiKey"
                            defaultValue={apiKey}
                            className="swal2-input"
                            style={{ margin: 0, fontSize: '0.8em', height: '30px', paddingRight: '30px' }} // 添加右侧内边距
                            onChange={(e) => setApiKey(e.target.value)}
                        />
                        <span
                            onClick={() => copyToClipboard(apiKey)} // 使用函数式更新
                            style={{
                                position: 'absolute',
                                right: '5px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                cursor: 'pointer'
                            }}
                        >
                            📋
                        </span>
                    </div>
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
                                        <MsgDisplay message={message.content} />
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
                                        <MsgDisplay message={message.content} />
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
                <button type="submit" disabled={loading}>发送</button> 
            </form>
            {loading && <div className="loading"></div>} 
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
