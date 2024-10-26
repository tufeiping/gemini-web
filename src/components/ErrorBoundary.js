import React, { Component } from 'react';
import Swal from 'sweetalert2';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Error caught in ErrorBoundary:", error, errorInfo);
        Swal.fire({
            title: '发生错误',
            text: '请刷新页面或稍后再试。',
            icon: 'error',
            confirmButtonText: '刷新',
        }).then(() => {
            window.location.reload();
        });
    }

    render() {
        if (this.state.hasError) {
            return <h1>发生错误，请刷新页面。</h1>;
        }

        return this.props.children; 
    }
}

export default ErrorBoundary;
