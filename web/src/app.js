import { Auth } from './api.js';
import { Dashboard } from './pages/dashboard.js';
import { ProjectList } from './pages/projects.js';
import { ProjectDetail } from './pages/project-detail.js';
import { IssueList } from './pages/issues.js';
import { MergeRequestList } from './pages/merge-requests.js';
import { SettingsPage } from './pages/settings.js';
import { ReleasesPage, StatsPage } from './pages/releases-stats.js';
import { GroupsPage, ActivityPage, MilestonesPage, SnippetsPage } from './pages/placeholder.js';

Auth.init();

// 使用 HTML5 History API，不使用 hash 路由
m.route.prefix = '';

const routes = {
    '/': Dashboard,
    '/projects': ProjectList,
    '/project/:owner/:repo': ProjectDetail,
    '/issues/:owner/:repo': IssueList,
    '/merge-requests/:owner/:repo': MergeRequestList,
    '/releases/:owner/:repo': ReleasesPage,
    '/stats/:owner/:repo': StatsPage,
    '/settings/:owner/:repo': SettingsPage,
    '/groups': GroupsPage,
    '/activity': ActivityPage,
    '/milestones': MilestonesPage,
    '/snippets': SnippetsPage
};

m.route(document.getElementById('app'), '/', routes);
