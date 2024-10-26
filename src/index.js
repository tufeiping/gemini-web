import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


// 处理未捕获的错误
window.addEventListener('error', (event) => {
  console.error('全局错误:', event.error);
  // 这里可以添加错误处理逻辑
});

// 处理未处理的 Promise 拒绝
window.addEventListener('unhandledrejection', (event) => {
  console.error('未处理的 Promise 拒绝:', event.reason);
  // 这里可以添加错误处理逻辑
});