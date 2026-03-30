import { Auth, API } from './api.js';
import { Dashboard } from './pages/dashboard.js';
import { ProjectList } from './pages/projects.js';
import { ProjectDetail } from './pages/project-detail.js';
import { IssueList } from './pages/issues.js';
import { IssueDetail } from './pages/issue-detail.js';
import { PullRequestList } from './pages/pull-requests.js';
import { PullRequestDetail } from './pages/pr-detail.js';
import { SettingsPage } from './pages/settings.js';
import { ReleasesPage, StatsPage } from './pages/releases-stats.js';
import { Groups, GroupDetail, NewGroup } from './pages/groups.js';
import { Activities } from './pages/activities.js';
import { TaskList } from './pages/tasks.js';
import { TaskDetail } from './pages/task-detail.js';
import { SnippetsPage, SnippetDetail, NewSnippet, EditSnippet } from './pages/snippets.js';
import { CreateProjectPage } from './pages/create-project.js';
import { MigrateProjectPage } from './pages/migrate-project.js';
import { LoginPage } from './pages/login.js';

Auth.init();

async function loadTheme() {
    try {
        const stats = await API.get('/stats');
        if (stats && stats.theme) {
            document.documentElement.setAttribute('data-theme', stats.theme);
        } else {
            document.documentElement.setAttribute('data-theme', 'orange');
        }
    } catch (err) {
        console.error('Failed to load theme:', err);
        document.documentElement.setAttribute('data-theme', 'orange');
    }
}

loadTheme();

const AuthGuard = {
    oninit(vnode) {
        if (!Auth.isAuthenticated()) {
            m.route.set('/login');
        }
    },
    view(vnode) {
        return Auth.isAuthenticated() ? m(vnode.attrs.component, vnode.attrs) : null;
    }
};

const withAuth = (component) => {
    return {
        view(vnode) {
            return m(AuthGuard, { ...vnode.attrs, component });
        }
    };
};

m.route.prefix = '';

const routes = {
    '/': Dashboard,
    '/login': LoginPage,
    '/projects': ProjectList,
    '/projects/new': withAuth(CreateProjectPage),
    '/projects/migrate': withAuth(MigrateProjectPage),
    '/project/:owner/:repo': ProjectDetail,
    '/issues/:owner/:repo': IssueList,
    '/issues/:owner/:repo/:number': IssueDetail,
    '/pull-requests/:owner/:repo': PullRequestList,
    '/pull-requests/:owner/:repo/:number': PullRequestDetail,
    '/tasks/:owner/:repo': TaskList,
    '/tasks/:owner/:repo/:id': TaskDetail,
    '/releases/:owner/:repo': ReleasesPage,
    '/stats/:owner/:repo': StatsPage,
    '/settings/:owner/:repo': withAuth(SettingsPage),
    '/groups': Groups,
    '/groups/new': withAuth(NewGroup),
    '/groups/:name': GroupDetail,
    '/activity': Activities,
    '/snippets': SnippetsPage,
    '/snippets/new': withAuth(NewSnippet),
    '/snippets/:id': SnippetDetail,
    '/snippets/:id/edit': withAuth(EditSnippet)
};

m.route(document.getElementById('app'), '/', routes);
