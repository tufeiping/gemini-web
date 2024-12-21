/**
 * Utils 组件
 * 包含应用程序中使用的工具函数。
 * 作者：Sunny
 */
import Swal from 'sweetalert2';
import { CHAT_HISTORY_LIST_DEFINE } from '../Config';
import 'sweetalert2/dist/sweetalert2.min.css';

const copyToClipboard = (text) => {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            Swal.fire('成功', '内容已复制到剪贴板', 'success');
        }).catch(err => {
            console.error('复制到剪贴板失败:', err);
            Swal.fire('错误', '复制失败，请手动复制内容。', 'error');
        });
    } else {
        // 兼容处理：使用旧的复制方式
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            Swal.fire('成功', '内容已复制到剪贴板', 'success');
        } catch (err) {
            console.error('复制到剪贴板失败:', err);
            Swal.fire('错误', '复制失败，请手动复制内容。', 'error');
        }
        document.body.removeChild(textArea);
    }
};

export { copyToClipboard };