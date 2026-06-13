import React, { Suspense } from 'react'
import { Box, Text, Spinner } from '@chakra-ui/react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import { Dashboard, Projects, CreateProject, MigrateProject } from './pages/HomePages'
import { LoginPage, Groups, NewGroup, GroupDetail } from './pages/CommunityPages'
import ProjectDetail from './pages/ProjectDetail'

const Activity = React.lazy(() => import('./pages/UserPages').then(m => ({ default: m.Activity })))
const UserManagement = React.lazy(() => import('./pages/UserPages').then(m => ({ default: m.UserManagement })))
const UserProfile = React.lazy(() => import('./pages/UserPages').then(m => ({ default: m.UserProfile })))
const UserSettings = React.lazy(() => import('./pages/UserPages').then(m => ({ default: m.UserSettings })))
const AdminPage = React.lazy(() => import('./pages/UserPages').then(m => ({ default: m.AdminPage })))
const Snippets = React.lazy(() => import('./pages/SnippetPages').then(m => ({ default: m.Snippets })))
const SnippetDetail = React.lazy(() => import('./pages/SnippetPages').then(m => ({ default: m.SnippetDetail })))
const NewSnippet = React.lazy(() => import('./pages/SnippetPages').then(m => ({ default: m.NewSnippet })))
const EditSnippet = React.lazy(() => import('./pages/SnippetPages').then(m => ({ default: m.EditSnippet })))

const ProjectTree = React.lazy(() => import('./pages/project/ProjectPages').then(m => ({ default: m.ProjectTree })))
const ProjectIssues = React.lazy(() => import('./pages/project/ProjectPages').then(m => ({ default: m.ProjectIssues })))
const ProjectPRs = React.lazy(() => import('./pages/project/ProjectPages').then(m => ({ default: m.ProjectPRs })))
const ProjectCommits = React.lazy(() => import('./pages/project/ProjectPages').then(m => ({ default: m.ProjectCommits })))
const ProjectBranches = React.lazy(() => import('./pages/project/ProjectPages').then(m => ({ default: m.ProjectBranches })))
const ProjectTags = React.lazy(() => import('./pages/project/ProjectPages').then(m => ({ default: m.ProjectTags })))
const ProjectReleases = React.lazy(() => import('./pages/project/ProjectPages').then(m => ({ default: m.ProjectReleases })))
const ProjectTasks = React.lazy(() => import('./pages/project/ProjectPages').then(m => ({ default: m.ProjectTasks })))
const ProjectSettings = React.lazy(() => import('./pages/project/ProjectPages').then(m => ({ default: m.ProjectSettings })))
const ProjectStats = React.lazy(() => import('./pages/project/ProjectPages').then(m => ({ default: m.ProjectStats })))
const IssueDetail = React.lazy(() => import('./pages/project/ProjectPages').then(m => ({ default: m.IssueDetail })))
const PRDetail = React.lazy(() => import('./pages/project/ProjectPages').then(m => ({ default: m.PRDetail })))
const NewIssue = React.lazy(() => import('./pages/project/ProjectPages').then(m => ({ default: m.NewIssue })))
const NewPR = React.lazy(() => import('./pages/project/ProjectPages').then(m => ({ default: m.NewPR })))
const NewTask = React.lazy(() => import('./pages/project/ProjectPages').then(m => ({ default: m.NewTask })))
const TaskDetail = React.lazy(() => import('./pages/project/ProjectPages').then(m => ({ default: m.TaskDetail })))
const CommitDetail = React.lazy(() => import('./pages/project/ProjectPages').then(m => ({ default: m.CommitDetail })))

function PageSpinner() {
  return (
    <Box display="flex" justifyContent="center" py="80px">
      <Spinner size="xl" color="#22c55e" />
    </Box>
  )
}

function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/home" replace />} />
            <Route path="home" element={<Dashboard />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/new" element={<CreateProject />} />
            <Route path="projects/migrate" element={<MigrateProject />} />
            <Route path="groups" element={<Groups />} />
            <Route path="groups/new" element={<NewGroup />} />
            <Route path="groups/:name" element={<GroupDetail />} />
            <Route path="activity" element={<Activity />} />
            <Route path="snippets" element={<Snippets />} />
            <Route path="snippets/new" element={<NewSnippet />} />
            <Route path="snippets/:id" element={<SnippetDetail />} />
            <Route path="snippets/:id/edit" element={<EditSnippet />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="users/:username" element={<UserProfile />} />
            <Route path="settings" element={<UserSettings />} />
            <Route path=":owner/:repo" element={<ProjectDetail />}>
              <Route index element={<ProjectTree />} />
              <Route path="tree" element={<ProjectTree />} />
              <Route path="tree/*" element={<ProjectTree />} />
              <Route path="issues" element={<ProjectIssues />} />
              <Route path="issues/new" element={<NewIssue />} />
              <Route path="issues/:number" element={<IssueDetail />} />
              <Route path="pull_requests" element={<ProjectPRs />} />
              <Route path="pull_requests/new" element={<NewPR />} />
              <Route path="pull_requests/:number" element={<PRDetail />} />
              <Route path="commits" element={<ProjectCommits />} />
              <Route path="commits/:sha" element={<CommitDetail />} />
              <Route path="branches" element={<ProjectBranches />} />
              <Route path="tags" element={<ProjectTags />} />
              <Route path="releases" element={<ProjectReleases />} />
              <Route path="tasks" element={<ProjectTasks />} />
              <Route path="tasks/new" element={<NewTask />} />
              <Route path="tasks/:id" element={<TaskDetail />} />
              <Route path="stats" element={<ProjectStats />} />
              <Route path="settings" element={<ProjectSettings />} />
            </Route>
            <Route
              path="*"
              element={
                <Box p={8} textAlign="center">
                  <Text fontSize="2xl" color="gray.500">页面开发中... 🚧</Text>
                </Box>
              }
            />
          </Route>
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}

export default App
