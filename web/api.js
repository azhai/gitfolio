const API_BASE_URL = '/api/v1';

class APIClient {
    constructor() {
        this.baseURL = API_BASE_URL;
        this.token = localStorage.getItem('token');
    }

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('token', token);
        } else {
            localStorage.removeItem('token');
        }
    }

    getToken() {
        return this.token;
    }

    isAuthenticated() {
        return !!this.token;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const config = {
            ...options,
            headers,
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new APIError(data.error || '请求失败', response.status);
            }

            return data;
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError('网络错误', 0);
        }
    }

    async get(endpoint, params = {}) {
        const searchParams = new URLSearchParams();
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                searchParams.append(key, params[key]);
            }
        });
        
        const url = searchParams.toString() ? `${endpoint}?${searchParams.toString()}` : endpoint;
        return this.request(url, { method: 'GET' });
    }

    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    async patch(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }
}

class APIError extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'APIError';
        this.status = status;
    }
}

const api = new APIClient();

const AuthService = {
    async register(username, email, password) {
        const data = await api.post('/auth/register', { username, email, password });
        if (data.token) {
            api.setToken(data.token);
        }
        return data;
    },

    async login(username, password) {
        const data = await api.post('/auth/login', { username, password });
        if (data.token) {
            api.setToken(data.token);
        }
        return data;
    },

    logout() {
        api.setToken(null);
        window.location.href = '/';
    },

    isAuthenticated() {
        return api.isAuthenticated();
    },

    getCurrentUser() {
        return api.get('/user/me');
    }
};

const UserService = {
    getCurrentUser() {
        return api.get('/user/me');
    },

    updateProfile(data) {
        return api.put('/user/me', data);
    },

    getUser(username) {
        return api.get(`/users/${username}`);
    },

    getUserRepositories(username, params = {}) {
        return api.get(`/users/${username}/repos`, params);
    }
};

const RepositoryService = {
    list(params = {}) {
        return api.get('/repos', params);
    },

    create(data) {
        return api.post('/repos', data);
    },

    get(owner, repo) {
        return api.get(`/${owner}/${repo}`);
    },

    update(owner, repo, data) {
        return api.put(`/${owner}/${repo}`, data);
    },

    delete(owner, repo) {
        return api.delete(`/${owner}/${repo}`);
    },

    star(owner, repo) {
        return api.post(`/${owner}/${repo}/star`);
    },

    unstar(owner, repo) {
        return api.delete(`/${owner}/${repo}/star`);
    },

    watch(owner, repo) {
        return api.post(`/${owner}/${repo}/watch`);
    },

    unwatch(owner, repo) {
        return api.delete(`/${owner}/${repo}/watch`);
    }
};

const IssueService = {
    list(owner, repo, params = {}) {
        return api.get(`/${owner}/${repo}/issues`, params);
    },

    create(owner, repo, data) {
        return api.post(`/${owner}/${repo}/issues`, data);
    },

    get(owner, repo, number) {
        return api.get(`/${owner}/${repo}/issues/${number}`);
    },

    update(owner, repo, number, data) {
        return api.put(`/${owner}/${repo}/issues/${number}`, data);
    },

    getComments(owner, repo, number) {
        return api.get(`/${owner}/${repo}/issues/${number}/comments`);
    },

    createComment(owner, repo, number, data) {
        return api.post(`/${owner}/${repo}/issues/${number}/comments`, data);
    }
};

const MergeRequestService = {
    list(owner, repo, params = {}) {
        return api.get(`/${owner}/${repo}/merge_requests`, params);
    },

    create(owner, repo, data) {
        return api.post(`/${owner}/${repo}/merge_requests`, data);
    },

    get(owner, repo, number) {
        return api.get(`/${owner}/${repo}/merge_requests/${number}`);
    },

    update(owner, repo, number, data) {
        return api.put(`/${owner}/${repo}/merge_requests/${number}`, data);
    },

    merge(owner, repo, number) {
        return api.post(`/${owner}/${repo}/merge_requests/${number}/merge`);
    },

    close(owner, repo, number) {
        return api.post(`/${owner}/${repo}/merge_requests/${number}/close`);
    },

    reopen(owner, repo, number) {
        return api.post(`/${owner}/${repo}/merge_requests/${number}/reopen`);
    }
};

const StatsService = {
    get() {
        return api.get('/stats');
    }
};

window.APIClient = APIClient;
window.APIError = APIError;
window.api = api;
window.AuthService = AuthService;
window.UserService = UserService;
window.RepositoryService = RepositoryService;
window.IssueService = IssueService;
window.MergeRequestService = MergeRequestService;
window.StatsService = StatsService;
