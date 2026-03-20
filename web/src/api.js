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
        const headers = {};

        if (options.headers) {
            Object.keys(options.headers).forEach(key => {
                headers[key] = options.headers[key];
            });
        }

        if (Auth.token) {
            headers['Authorization'] = `Bearer ${Auth.token}`;
        }

        const requestOptions = {
            url: `${API_BASE_URL}${options.url}`,
            method: options.method || 'GET',
            headers: headers
        };

        if (options.body) {
            requestOptions.body = options.body;
        }

        return m.request(requestOptions).catch(error => {
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
    },

    syncPull(owner, repo) {
        return API.post(`/${owner}/${repo}/sync/pull`);
    },

    syncPush(owner, repo, remoteUrl) {
        return API.post(`/${owner}/${repo}/sync/push`, { remote_url: remoteUrl });
    },

    getTree(owner, repo, path, ref) {
        let url = `/${owner}/${repo}/tree?path=${encodeURIComponent(path || '')}`;
        if (ref) url += `&ref=${encodeURIComponent(ref)}`;
        return API.get(url);
    },

    getFile(owner, repo, path, ref) {
        let url = `/${owner}/${repo}/file?path=${encodeURIComponent(path || '')}`;
        if (ref) url += `&ref=${encodeURIComponent(ref)}`;
        return API.get(url);
    },

    getBranches(owner, repo) {
        return API.get(`/${owner}/${repo}/branches`);
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

const GroupService = {
    list(page, perPage) {
        let url = '/groups';
        const params = [];
        if (page) params.push(`page=${page}`);
        if (perPage) params.push(`per_page=${perPage}`);
        if (params.length) url += '?' + params.join('&');
        return API.get(url);
    },

    get(name) {
        return API.get(`/groups/${name}`);
    },

    create(data) {
        return API.post('/groups', data);
    }
};

const ActivityService = {
    list(page, perPage, userId) {
        let url = '/activities';
        const params = [];
        if (page) params.push(`page=${page}`);
        if (perPage) params.push(`per_page=${perPage}`);
        if (userId) params.push(`user_id=${userId}`);
        if (params.length) url += '?' + params.join('&');
        return API.get(url);
    },

    create(data) {
        return API.post('/activities', data);
    }
};

const MilestoneService = {
    list(owner, repo) {
        return API.get(`/${owner}/${repo}/milestones`);
    },

    create(owner, repo, data) {
        return API.post(`/${owner}/${repo}/milestones`, data);
    }
};

const SnippetService = {
    list(page, perPage, language) {
        let url = '/snippets';
        const params = [];
        if (page) params.push(`page=${page}`);
        if (perPage) params.push(`per_page=${perPage}`);
        if (language) params.push(`language=${language}`);
        if (params.length) url += '?' + params.join('&');
        return API.get(url);
    },

    get(id) {
        return API.get(`/snippets/${id}`);
    },

    create(data) {
        return API.post('/snippets', data);
    },

    update(id, data) {
        return API.put(`/snippets/${id}`, data);
    },

    delete(id) {
        return API.delete(`/snippets/${id}`);
    }
};

export { Auth, API, UserService, RepositoryService, IssueService, MergeRequestService, GroupService, ActivityService, MilestoneService, SnippetService };
