document.addEventListener('DOMContentLoaded', async function() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            sidebar.classList.toggle('active');
        });
    }

    initDropdowns();
    initSearch();
    initTooltips();
    initAnimations();
    await initAuth();
    initPageSpecific();
});

function initDropdowns() {
    const userMenu = document.querySelector('.user-menu');
    
    if (userMenu) {
        userMenu.addEventListener('click', function(e) {
            e.stopPropagation();
            const dropdown = this.querySelector('.dropdown-menu');
            if (dropdown) {
                dropdown.classList.toggle('show');
            }
        });
    }

    document.addEventListener('click', function() {
        const dropdowns = document.querySelectorAll('.dropdown-menu');
        dropdowns.forEach(dropdown => {
            dropdown.classList.remove('show');
        });
    });
}

function initSearch() {
    const searchBox = document.querySelector('.search-box input');
    
    if (searchBox) {
        searchBox.addEventListener('focus', function() {
            this.parentElement.classList.add('focused');
        });

        searchBox.addEventListener('blur', function() {
            this.parentElement.classList.remove('focused');
        });

        searchBox.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = this.value.trim();
                if (query) {
                    performSearch(query);
                }
            }
        });
    }
}

function performSearch(query) {
    console.log('Searching for:', query);
    showNotification(`搜索: "${query}"`, 'info');
}

function initTooltips() {
    const elementsWithTooltip = document.querySelectorAll('[title]');
    
    elementsWithTooltip.forEach(element => {
        const title = element.getAttribute('title');
        if (title) {
            element.setAttribute('data-tooltip', title);
            element.removeAttribute('title');
            
            element.addEventListener('mouseenter', function(e) {
                showTooltip(e, title);
            });
            
            element.addEventListener('mouseleave', function() {
                hideTooltip();
            });
        }
    });
}

function showTooltip(event, text) {
    let tooltip = document.getElementById('tooltip');
    
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'tooltip';
        tooltip.style.cssText = `
            position: fixed;
            background: rgba(0, 0, 0, 0.85);
            color: white;
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 10000;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s;
        `;
        document.body.appendChild(tooltip);
    }
    
    tooltip.textContent = text;
    tooltip.style.opacity = '1';
    
    const rect = event.target.getBoundingClientRect();
    tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
    tooltip.style.top = rect.top - tooltip.offsetHeight - 8 + 'px';
}

function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    if (tooltip) {
        tooltip.style.opacity = '0';
    }
}

function initAnimations() {
    const cards = document.querySelectorAll('.card');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, {
        threshold: 0.1
    });

    cards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        observer.observe(card);
    });
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: ${type === 'success' ? '#108548' : type === 'error' ? '#c91c00' : '#1f75cb'};
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        max-width: 400px;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

function formatTime(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 7) return `${days} 天前`;
    
    return date.toLocaleDateString('zh-CN');
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('已复制到剪贴板', 'success');
    }).catch(() => {
        showNotification('复制失败', 'error');
    });
}

function debounce(func, wait) {
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

function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

window.GitFolio = {
    showNotification,
    formatTime,
    copyToClipboard,
    debounce,
    throttle
};

async function initAuth() {
    if (!AuthService.isAuthenticated()) {
        updateAuthUI(null);
        return;
    }

    try {
        const user = await AuthService.getCurrentUser();
        updateAuthUI(user);
    } catch (error) {
        console.error('Failed to get current user:', error);
        AuthService.logout();
        updateAuthUI(null);
    }
}

function updateAuthUI(user) {
    const userMenu = document.querySelector('.user-menu');
    if (!userMenu) return;

    if (user) {
        const avatar = userMenu.querySelector('.avatar');
        const username = userMenu.querySelector('.username');
        
        if (avatar) {
            avatar.src = user.avatar_url || `https://via.placeholder.com/32?text=${user.username.charAt(0).toUpperCase()}`;
        }
        if (username) {
            username.textContent = user.username;
        }

        userMenu.onclick = () => showUserMenu(user);
    } else {
        userMenu.innerHTML = `
            <a href="#" class="btn btn-sm" onclick="showLoginModal(); return false;">登录</a>
        `;
        userMenu.onclick = null;
    }
}

function showUserMenu(user) {
    const existingMenu = document.querySelector('.user-dropdown');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }

    const dropdown = document.createElement('div');
    dropdown.className = 'user-dropdown';
    dropdown.style.cssText = `
        position: absolute;
        top: 60px;
        right: 20px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        padding: 8px 0;
        min-width: 200px;
        z-index: 1000;
    `;

    dropdown.innerHTML = `
        <div style="padding: 12px 16px; border-bottom: 1px solid #e1e4e8;">
            <div style="font-weight: 600;">${user.username}</div>
            <div style="font-size: 12px; color: #6a737d;">${user.email || ''}</div>
        </div>
        <a href="#" style="display: block; padding: 8px 16px; color: #24292e; text-decoration: none;" onmouseover="this.style.background='#f6f8fa'" onmouseout="this.style.background='white'">
            <i class="fas fa-user"></i> 个人资料
        </a>
        <a href="#" style="display: block; padding: 8px 16px; color: #24292e; text-decoration: none;" onmouseover="this.style.background='#f6f8fa'" onmouseout="this.style.background='white'">
            <i class="fas fa-cog"></i> 设置
        </a>
        <div style="border-top: 1px solid #e1e4e8; margin-top: 8px; padding-top: 8px;">
            <a href="#" onclick="AuthService.logout(); return false;" style="display: block; padding: 8px 16px; color: #c91c00; text-decoration: none;" onmouseover="this.style.background='#f6f8fa'" onmouseout="this.style.background='white'">
                <i class="fas fa-sign-out-alt"></i> 登出
            </a>
        </div>
    `;

    document.body.appendChild(dropdown);

    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!dropdown.contains(e.target) && !document.querySelector('.user-menu').contains(e.target)) {
                dropdown.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 0);
}

function showLoginModal() {
    const existingModal = document.querySelector('.login-modal');
    if (existingModal) {
        existingModal.remove();
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'login-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    modal.innerHTML = `
        <div style="background: white; border-radius: 8px; padding: 32px; width: 400px; max-width: 90%;">
            <h2 style="margin: 0 0 24px; font-size: 24px;">登录 GitFolio</h2>
            <form id="loginForm">
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">用户名</label>
                    <input type="text" id="loginUsername" required style="width: 100%; padding: 8px 12px; border: 1px solid #e1e4e8; border-radius: 6px; font-size: 14px;">
                </div>
                <div style="margin-bottom: 24px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">密码</label>
                    <input type="password" id="loginPassword" required style="width: 100%; padding: 8px 12px; border: 1px solid #e1e4e8; border-radius: 6px; font-size: 14px;">
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%; margin-bottom: 12px;">登录</button>
                <button type="button" class="btn" style="width: 100%;" onclick="this.closest('.login-modal').remove()">取消</button>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    };

    document.getElementById('loginForm').onsubmit = async (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        try {
            await AuthService.login(username, password);
            showNotification('登录成功', 'success');
            modal.remove();
            window.location.reload();
        } catch (error) {
            showNotification(error.message || '登录失败', 'error');
        }
    };
}

function initPageSpecific() {
    const path = window.location.pathname;
    
    if (path === '/' || path === '/index.html') {
        initHomePage();
    } else if (path === '/projects' || path === '/projects.html') {
        initProjectsPage();
    } else if (path === '/issues' || path === '/issues.html') {
        initIssuesPage();
    } else if (path === '/project-detail' || path === '/project-detail.html') {
        initProjectDetailPage();
    } else if (path === '/merge-requests' || path === '/merge-requests.html') {
        initMergeRequestsPage();
    }
}

async function initHomePage() {
    await Promise.all([
        loadHomeStats(),
        loadRecentProjects()
    ]);
}

async function loadHomeStats() {
    try {
        const stats = await StatsService.get();
        
        const statItems = document.querySelectorAll('.stats-card .stat-item');
        if (statItems.length >= 4) {
            statItems[0].querySelector('.stat-value').textContent = stats.total_repos || 0;
            statItems[0].querySelector('.stat-label').textContent = '项目';
            
            statItems[1].querySelector('.stat-value').textContent = stats.total_issues || 0;
            statItems[1].querySelector('.stat-label').textContent = 'Issue';
            
            statItems[2].querySelector('.stat-value').textContent = stats.total_mrs || 0;
            statItems[2].querySelector('.stat-label').textContent = '合并请求';
            
            statItems[3].querySelector('.stat-value').textContent = stats.total_users || 0;
            statItems[3].querySelector('.stat-label').textContent = '用户';
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

async function loadRecentProjects() {
    const projectList = document.querySelector('.projects-card .project-list');
    if (!projectList) return;

    try {
        const response = await RepositoryService.list({ page: 1, per_page: 5 });
        projectList.innerHTML = '';
        
        response.data.forEach(repo => {
            const item = createHomeProjectItem(repo);
            projectList.appendChild(item);
        });
    } catch (error) {
        console.error('Failed to load recent projects:', error);
    }
}

function createHomeProjectItem(repo) {
    const item = document.createElement('div');
    item.className = 'project-item';
    item.innerHTML = `
        <div class="project-icon">
            <i class="fas fa-book"></i>
        </div>
        <div class="project-info">
            <h3><a href="/project-detail?owner=${repo.owner}&repo=${repo.name}">${repo.owner}/${repo.name}</a></h3>
            <p>${repo.description || '暂无描述'}</p>
            <div class="project-meta">
                <span><i class="fas fa-star"></i> ${repo.stars_count || 0}</span>
                <span><i class="fas fa-code-branch"></i> ${repo.forks_count || 0}</span>
            </div>
        </div>
        <div class="project-actions">
            <button class="btn-icon" onclick="toggleStar('${repo.owner}', '${repo.name}')"><i class="fas fa-star"></i></button>
        </div>
    `;
    return item;
}

async function initProjectsPage() {
    const projectsGrid = document.querySelector('.projects-grid');
    if (!projectsGrid) return;

    try {
        const response = await RepositoryService.list({ page: 1, per_page: 10 });
        projectsGrid.innerHTML = '';
        
        response.data.forEach(repo => {
            const card = createProjectCard(repo);
            projectsGrid.appendChild(card);
        });

        updatePagination(response.total, response.page, response.per_page);
    } catch (error) {
        console.error('Failed to load projects:', error);
        showNotification('加载项目失败', 'error');
    }
}

function createProjectCard(repo) {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
        <div class="project-card-header">
            <div class="project-card-title">
                <h3><a href="/project-detail?owner=${repo.owner}&repo=${repo.name}">${repo.owner}/${repo.name}</a></h3>
                <span class="project-visibility ${repo.is_private ? 'private' : ''}">${repo.is_private ? '私有' : '公开'}</span>
            </div>
            <p class="project-card-description">${repo.description || '暂无描述'}</p>
        </div>
        <div class="project-card-body">
            <div class="project-stats">
                <span class="project-stat">
                    <i class="fas fa-star"></i> ${repo.stars_count || 0}
                </span>
                <span class="project-stat">
                    <i class="fas fa-code-branch"></i> ${repo.forks_count || 0}
                </span>
                <span class="project-stat">
                    <i class="fas fa-eye"></i> ${repo.watch_count || 0}
                </span>
            </div>
        </div>
        <div class="project-card-footer">
            <span class="project-last-activity">更新于 ${formatTime(repo.updated_at)}</span>
            <div class="project-actions">
                <button class="btn-icon" onclick="toggleStar('${repo.owner}', '${repo.name}')"><i class="fas fa-star"></i></button>
            </div>
        </div>
    `;
    return card;
}

async function initIssuesPage() {
    const issuesList = document.querySelector('.issues-list');
    if (!issuesList) return;

    const urlParams = new URLSearchParams(window.location.search);
    const owner = urlParams.get('owner') || 'ryan';
    const repo = urlParams.get('repo') || 'gitfolio-core';

    try {
        const response = await IssueService.list(owner, repo, { page: 1, per_page: 20 });
        issuesList.innerHTML = '';
        
        response.data.forEach(issue => {
            const item = createIssueItem(issue);
            issuesList.appendChild(item);
        });
    } catch (error) {
        console.error('Failed to load issues:', error);
        showNotification('加载 Issue 失败', 'error');
    }
}

function createIssueItem(issue) {
    const item = document.createElement('div');
    item.className = 'issue-item';
    item.innerHTML = `
        <span class="issue-status ${issue.is_closed ? 'closed' : 'open'}">
            <i class="fas fa-exclamation-circle"></i>
        </span>
        <div class="issue-info">
            <h4><a href="#">${issue.title}</a></h4>
            <span class="issue-meta">#${issue.number || issue.id} · 由 ${issue.author} 创建于 ${formatTime(issue.created_at)}</span>
        </div>
    `;
    return item;
}

async function initProjectDetailPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const owner = urlParams.get('owner') || 'ryan';
    const repo = urlParams.get('repo') || 'gitfolio-core';

    try {
        const repository = await RepositoryService.get(owner, repo);
        updateProjectDetailUI(repository);
    } catch (error) {
        console.error('Failed to load repository:', error);
        showNotification('加载项目失败', 'error');
    }
}

function updateProjectDetailUI(repo) {
    const titleElement = document.querySelector('.project-title-section h1');
    if (titleElement) {
        titleElement.textContent = `${repo.owner}/${repo.name}`;
    }

    const descriptionElement = document.querySelector('.project-description');
    if (descriptionElement) {
        descriptionElement.textContent = repo.description || '暂无描述';
    }

    const starsElement = document.querySelector('.stat-item .fa-star');
    if (starsElement) {
        const parent = starsElement.closest('.stat-item');
        if (parent) {
            parent.innerHTML = `<i class="fas fa-star"></i> ${repo.stars_count || 0} Stars`;
        }
    }

    const forksElement = document.querySelector('.stat-item .fa-code-branch');
    if (forksElement) {
        const parent = forksElement.closest('.stat-item');
        if (parent) {
            parent.innerHTML = `<i class="fas fa-code-branch"></i> ${repo.forks_count || 0} Forks`;
        }
    }
}

function updatePagination(total, currentPage, perPage) {
    const paginationInfo = document.querySelector('.pagination-info');
    const totalPages = Math.ceil(total / perPage);
    
    if (paginationInfo) {
        const start = (currentPage - 1) * perPage + 1;
        const end = Math.min(currentPage * perPage, total);
        paginationInfo.textContent = `显示 ${start}-${end} 条，共 ${total} 条`;
    }
}

async function toggleStar(owner, repo) {
    if (!AuthService.isAuthenticated()) {
        showLoginModal();
        return;
    }

    try {
        await RepositoryService.star(owner, repo);
        showNotification('已星标', 'success');
    } catch (error) {
        showNotification('操作失败', 'error');
    }
}

async function initMergeRequestsPage() {
    const mrList = document.querySelector('.mr-list');
    if (!mrList) return;

    const urlParams = new URLSearchParams(window.location.search);
    const owner = urlParams.get('owner') || 'alice';
    const repo = urlParams.get('repo') || 'awesome-project';

    try {
        const response = await MergeRequestService.list(owner, repo, { page: 1, per_page: 20 });
        mrList.innerHTML = '';
        
        response.data.forEach(mr => {
            const item = createMergeRequestItem(mr);
            mrList.appendChild(item);
        });
    } catch (error) {
        console.error('Failed to load merge requests:', error);
        showNotification('加载合并请求失败', 'error');
    }
}

function createMergeRequestItem(mr) {
    const item = document.createElement('div');
    item.className = 'mr-item';
    
    let statusClass = 'open';
    let statusIcon = 'fa-code-branch';
    let statusText = '打开';
    
    if (mr.is_merged) {
        statusClass = 'merged';
        statusIcon = 'fa-check';
        statusText = '已合并';
    } else if (mr.is_closed) {
        statusClass = 'closed';
        statusIcon = 'fa-times';
        statusText = '已关闭';
    }
    
    item.innerHTML = `
        <span class="mr-status ${statusClass}">
            <i class="fas ${statusIcon}"></i>
        </span>
        <div class="mr-info">
            <h4><a href="#">${mr.title}</a></h4>
            <span class="mr-meta">#${mr.number || mr.id} · 由 ${mr.author || 'Unknown'} 创建于 ${formatTime(mr.created_at)}</span>
        </div>
        <div class="mr-branches">
            <span class="branch">${mr.source_branch}</span>
            <i class="fas fa-arrow-right"></i>
            <span class="branch">${mr.target_branch}</span>
        </div>
        <span class="mr-status-badge ${statusClass}">${statusText}</span>
    `;
    return item;
}

window.showLoginModal = showLoginModal;
window.toggleStar = toggleStar;
