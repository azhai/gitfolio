import { Auth } from './api.js';
import { Dashboard } from './pages/dashboard.js';
import { ProjectList } from './pages/projects.js';
import { ProjectDetail } from './pages/project-detail.js';
import { IssueList } from './pages/issues.js';
import { MergeRequestList } from './pages/merge-requests.js';
import { SettingsPage } from './pages/settings.js';
import { ReleasesPage, StatsPage } from './pages/releases-stats.js';
import { Groups, GroupDetail, NewGroup } from './pages/groups.js';
import { Activities } from './pages/activities.js';
import { Milestones, NewMilestone } from './pages/milestones.js';
import { SnippetsPage, SnippetDetail, NewSnippet, EditSnippet } from './pages/snippets.js';
import { CreateProjectPage } from './pages/create-project.js';
import { MigrateProjectPage } from './pages/migrate-project.js';
import { LoginPage } from './pages/login.js';

Auth.init();

const requireAuth = function(vnode) {
    if (!Auth.isAuthenticated()) {
        m.route.set('/login');
        return false;
    }
    return true;
};

m.route.prefix = '';

const routes = {
    '/': Dashboard,
    '/login': LoginPage,
    '/projects': ProjectList,
    '/projects/new': CreateProjectPage,
    '/projects/migrate': MigrateProjectPage,
    '/project/:owner/:repo': ProjectDetail,
    '/issues/:owner/:repo': IssueList,
    '/merge-requests/:owner/:repo': MergeRequestList,
    '/releases/:owner/:repo': ReleasesPage,
    '/stats/:owner/:repo': StatsPage,
    '/settings/:owner/:repo': SettingsPage,
    '/groups': Groups,
    '/groups/new': NewGroup,
    '/groups/:name': GroupDetail,
    '/activity': Activities,
    '/milestones/:owner/:repo': Milestones,
    '/milestones/:owner/:repo/new': NewMilestone,
    '/snippets': SnippetsPage,
    '/snippets/new': NewSnippet,
    '/snippets/:id': SnippetDetail,
    '/snippets/:id/edit': EditSnippet
};

m.route(document.getElementById('app'), '/', routes);
