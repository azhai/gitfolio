import { request } from 'mithril';

const API_BASE_URL = '/api/v1';

const Auth = {
    token: null,
    
    init() {
        this.token = localStorage.getItem('token');
    },
    
    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('token', token);
        } else {
            localStorage.removeItem('token');
        }
    },
    
    isAuthenticated() {
        return !!this.token;
    }
};

const API = {
    request(options) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (Auth.token) {
            headers['Authorization'] = `Bearer ${Auth.token}`;
        }
        
        return request({
            url: `${API_BASE_URL}${options.url}`,
            method: options.method || 'GET',
            body: options.body,
            headers
        }).catch((error) => {
            console.error('API Error:', error);
            if (error.code === 401) {
                Auth.setToken(null);
                m.route.set('/login');
            }
            throw error;
        });
    },
    
    get(url) {
        return this.request({ url, method: 'GET' });
    },
    
    post(url, body) {
        return this.request({ url, method: 'POST', body });
    },
    
    put(url, body) {
        return this.request({ url, method: 'PUT', body });
    },
    
    delete(url) {
        return this.request({ url, method: 'DELETE' });
    }
};

const UserService = {
    list() {
        return API.get('/users');
    },
    
    get(id) {
        return API.get(`/users/${id}`);
    },
    
    create(data) {
        return API.post('/users', data);
    },
    
    update(id, data) {
        return API.put(`/users/${id}`, data);
    },
    
    delete(id) {
        return API.delete(`/users/${id}`);
    }
};

const RepositoryService = {
    list(owner) {
        const url = owner ? `/users/${owner}/repos` : '/repos';
        return API.get(url);
    },

    get(owner, repo) {
        return API.get(`/${owner}/${repo}`);
    },

    create(owner, data) {
        return API.post('/repos', data);
    },

    update(owner, repo, data) {
        return API.put(`/${owner}/${repo}`, data);
    },

    delete(owner, repo) {
        return API.delete(`/${owner}/${repo}`);
    }
};

const IssueService = {
    list(owner, repo) {
        const url = owner && repo 
            ? `/${owner}/${repo}/issues`
            : '/issues';
        return API.get(url);
    },
    
    get(owner, repo, number) {
        return API.get(`/${owner}/${repo}/issues/${number}`);
    },
    
    create(owner, repo, data) {
        return API.post(`/${owner}/${repo}/issues`, data);
    },
    
    update(owner, repo, number, data) {
        return API.put(`/${owner}/${repo}/issues/${number}`, data);
    }
};

const MergeRequestService = {
    list(owner, repo) {
        const url = owner && repo 
            ? `/${owner}/${repo}/merge_requests`
            : '/merge_requests';
        return API.get(url);
    },
    
    get(owner, repo, number) {
        return API.get(`/${owner}/${repo}/merge_requests/${number}`);
    },
    
    create(owner, repo, data) {
        return API.post(`/${owner}/${repo}/merge_requests`, data);
    },
    
    update(owner, repo, number, data) {
        return API.put(`/${owner}/${repo}/merge_requests/${number}`, data);
    }
};

export { Auth, API, UserService, RepositoryService, IssueService, MergeRequestService };
