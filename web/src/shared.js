// Shared constants and configurations
const Constants = {
    API_BASE_URL: '/api/v1',
    DEFAULT_PAGE: 1,
    DEFAULT_PER_PAGE: 30,
    DEFAULT_BRANCH: 'main',
    
    HTTP_STATUS: {
        OK: 200,
        CREATED: 201,
        BAD_REQUEST: 400,
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        INTERNAL_ERROR: 500
    },
    
    VISIBILITY: {
        PUBLIC: 'public',
        PRIVATE: 'private'
    },
    
    PROJECT_TYPE: {
        MIRROR: 'mirror',
        OWNED: 'owned',
        FORK: 'fork'
    },
    
    ISSUE_STATE: {
        OPEN: 'open',
        CLOSED: 'closed',
        ALL: 'all'
    },
    
    PR_STATUS: {
        OPEN: 'open',
        CLOSED: 'closed',
        MERGED: 'merged'
    }
};

const Utils = {
    buildQueryString(params) {
        const parts = [];
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
                parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`);
            }
        });
        return parts.length > 0 ? '?' + parts.join('&') : '';
    },
    
    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    
    truncate(text, maxLength = 100) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    },
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};
