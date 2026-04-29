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
    },
    
    logout() {
        return API.post('/auth/logout').then(() => {
            this.setToken(null);
            localStorage.removeItem('user');
        }).catch(() => {
            this.setToken(null);
            localStorage.removeItem('user');
        });
    }
};

const API = {
    normalizeResponse(data) {
        if (data === null) {
            return {};
        }
        if (data && typeof data === 'object' && data.data === null) {
            data.data = [];
        }
        return data;
    },

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
            url: `${Constants.API_BASE_URL}${options.url}`,
            method: options.method || 'GET',
            headers: headers,
            extract: function(xhr) {
                return {
                    status: xhr.status,
                    body: xhr.responseText ? JSON.parse(xhr.responseText) : null
                };
            }
        };

        if (options.body) {
            requestOptions.body = options.body;
        }

        return m.request(requestOptions).then(data => {
            if (data.status === 401) {
                Auth.setToken(null);
                localStorage.removeItem('user');
                m.route.set('/login');
                throw new Error('登录已过期，请重新登录');
            }
            if (data.status >= 400) {
                let errorMsg = '请求失败';
                if (data.body && data.body.error) {
                    errorMsg = data.body.error;
                } else if (data.body && data.body.message) {
                    errorMsg = data.body.message;
                } else if (typeof data.body === 'string') {
                    errorMsg = data.body;
                }
                throw new Error(errorMsg);
            }
            return this.normalizeResponse(data.body);
        }).catch(error => {
            if (error && error.message) {
                throw error;
            }
            let errorMsg = '请求失败';
            if (typeof error === 'string') {
                errorMsg = error;
            } else if (error && error.message) {
                errorMsg = error.message;
            } else if (error && error.error) {
                errorMsg = error.error;
            } else if (error && error.response && error.response.error) {
                errorMsg = error.response.error;
            } else if (error && typeof error === 'object') {
                try {
                    errorMsg = JSON.stringify(error);
                } catch (e) {
                    errorMsg = String(error);
                }
            }
            throw new Error(errorMsg);
        });
    },
    
    get(url, params = {}) {
        const queryString = Utils.buildQueryString(params);
        return this.request({ url: url + queryString, method: 'GET' });
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
    list(params = {}) {
        return API.get('/users', params);
    },
    
    get(id) {
        return API.get(`/users/${id}`);
    },
    
    create(data) {
        return API.post('/users', data);
    },
    
    update(username, data) {
        return API.put(`/users/${username}`, data);
    },
    
    uploadAvatar(username, formData) {
        return m.request({
            method: 'POST',
            url: `${API_BASE_URL}/users/${username}/avatar`,
            data: formData,
            headers: {
                'Authorization': `Bearer ${Auth.getToken()}`
            }
        });
    },
    
    delete(id) {
        return API.delete(`/users/${id}`);
    },

    changePassword(data) {
        return API.post('/user/me/password', data);
    }
};

const RepositoryService = {
    list(owner, params = {}) {
        const url = owner ? `/users/${owner}/repos` : '/repos';
        return API.get(url, params);
    },

    get(owner, repo) {
        return API.get(`/${owner}/${repo}`);
    },

    create(data) {
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

    getTree(owner, repo, params = {}) {
        const { path, ...queryParams } = params;
        const url = path ? `/${owner}/${repo}/tree/${path}` : `/${owner}/${repo}/tree`;
        return API.get(url, queryParams);
    },

    getFile(owner, repo, params = {}) {
        const { path, ...queryParams } = params;
        const url = path ? `/${owner}/${repo}/file/${path}` : `/${owner}/${repo}/file`;
        return API.get(url, queryParams);
    },

    getBranches(owner, repo) {
        return API.get(`/${owner}/${repo}/branches`);
    },
    
    getTags(owner, repo) {
        return API.get(`/${owner}/${repo}/tags`);
    },
    
    getCommits(owner, repo, params = {}) {
        return API.get(`/${owner}/${repo}/commits`, params);
    },
    
    getLastCommit(owner, repo, ref = 'HEAD') {
        return API.get(`/${owner}/${repo}/last-commit`, { ref });
    },
    
    getContributors(owner, repo) {
        return API.get(`/${owner}/${repo}/contributors`);
    },
    
    getCodeStats(owner, repo) {
        return API.get(`/${owner}/${repo}/code-stats`);
    },
    
    getCommitActivity(owner, repo, days = 30) {
        return API.get(`/${owner}/${repo}/commit-activity`, { days });
    },
    
    rebase(owner, repo, data) {
        return API.post(`/${owner}/${repo}/rebase`, data);
    },
    
    stage(owner, repo, data) {
        return API.post(`/${owner}/${repo}/stage`, data);
    },
    
    unstage(owner, repo, data) {
        return API.post(`/${owner}/${repo}/unstage`, data);
    },
    
    commit(owner, repo, data) {
        return API.post(`/${owner}/${repo}/commit`, data);
    }
};

const IssueService = {
    list(owner, repo, params = {}) {
        const url = owner && repo 
            ? `/${owner}/${repo}/issues`
            : '/issues';
        return API.get(url, params);
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

const LabelService = {
    list(owner, repo) {
        return API.get(`/${owner}/${repo}/labels`);
    }
};

const ReleaseService = {
    list(owner, repo) {
        return API.get(`/${owner}/${repo}/releases`);
    },
    
    get(owner, repo, tag) {
        return API.get(`/${owner}/${repo}/releases/${tag}`);
    },
    
    sync(owner, repo) {
        return API.post(`/${owner}/${repo}/releases/sync`);
    }
};

const TaskService = {
    list(owner, repo, params = {}) {
        return API.get(`/${owner}/${repo}/tasks`, params);
    },
    
    get(owner, repo, id) {
        return API.get(`/${owner}/${repo}/tasks/${id}`);
    },
    
    create(owner, repo, data) {
        return API.post(`/${owner}/${repo}/tasks`, data);
    },
    
    update(owner, repo, id, data) {
        return API.put(`/${owner}/${repo}/tasks/${id}`, data);
    },
    
    delete(owner, repo, id) {
        return API.delete(`/${owner}/${repo}/tasks/${id}`);
    },
    
    uploadAttachment(owner, repo, id, formData) {
        return API.post(`/${owner}/${repo}/tasks/${id}/attachments`, formData);
    },
    
    deleteAttachment(owner, repo, id, attachmentId) {
        return API.delete(`/${owner}/${repo}/tasks/${id}/attachments/${attachmentId}`);
    },
    
    addIssue(owner, repo, id, issueId) {
        return API.post(`/${owner}/${repo}/tasks/${id}/issues`, { issue_id: issueId });
    },
    
    removeIssue(owner, repo, id, issueId) {
        return API.delete(`/${owner}/${repo}/tasks/${id}/issues/${issueId}`);
    }
};

const PullRequestService = {
    list(owner, repo, params = {}) {
        const url = owner && repo 
            ? `/${owner}/${repo}/pull_requests`
            : '/pull_requests';
        return API.get(url, params);
    },
    
    get(owner, repo, number) {
        return API.get(`/${owner}/${repo}/pull_requests/${number}`);
    },
    
    create(owner, repo, data) {
        return API.post(`/${owner}/${repo}/pull_requests`, data);
    },
    
    update(owner, repo, number, data) {
        return API.put(`/${owner}/${repo}/pull_requests/${number}`, data);
    },
    
    merge(owner, repo, number) {
        return API.post(`/${owner}/${repo}/pull_requests/${number}/merge`);
    },
    
    close(owner, repo, number) {
        return API.post(`/${owner}/${repo}/pull_requests/${number}/close`);
    },
    
    reopen(owner, repo, number) {
        return API.post(`/${owner}/${repo}/pull_requests/${number}/reopen`);
    }
};

const GroupService = {
    list(params = {}) {
        return API.get('/groups', params);
    },

    get(name) {
        return API.get(`/groups/${name}`);
    },

    create(data) {
        return API.post('/groups', data);
    },
    
    update(name, data) {
        return API.put(`/groups/${name}`, data);
    },
    
    uploadAvatar(name, formData) {
        return m.request({
            method: 'POST',
            url: `${API_BASE_URL}/groups/${name}/avatar`,
            data: formData,
            headers: {
                'Authorization': `Bearer ${Auth.getToken()}`
            }
        });
    },
    
    getMembers(name) {
        return API.get(`/groups/${name}/members`);
    },
    
    addMember(name, data) {
        return API.post(`/groups/${name}/members`, data);
    },
    
    removeMember(name, username) {
        return API.delete(`/groups/${name}/members/${username}`);
    }
};

const ActivityService = {
    list(params = {}) {
        return API.get('/activities', params);
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
    list(params = {}) {
        return API.get('/snippets', params);
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
