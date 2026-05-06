import React from 'react'
import { Box, Text } from '@chakra-ui/react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import LoginPage from './pages/LoginPage'
import Projects from './pages/Projects'
import CreateProject from './pages/CreateProject'
import MigrateProject from './pages/MigrateProject'
import Groups from './pages/Groups'
import NewGroup from './pages/NewGroup'
import GroupDetail from './pages/GroupDetail'
import Activity from './pages/Activity'
import Snippets from './pages/Snippets'
import { SnippetDetail, NewSnippet, EditSnippet } from './pages/SnippetPages'
import UserManagement from './pages/UserManagement'
import UserProfile from './pages/UserProfile'
import UserSettings from './pages/UserSettings'
import ProjectDetail from './pages/ProjectDetail'
import ProjectTree from './pages/project/ProjectTree'
import ProjectIssues from './pages/project/ProjectIssues'
import ProjectMRs from './pages/project/ProjectMRs'
import ProjectCommits from './pages/project/ProjectCommits'
import ProjectBranches from './pages/project/ProjectBranches'
import ProjectTags from './pages/project/ProjectTags'
import ProjectReleases from './pages/project/ProjectReleases'
import ProjectTasks from './pages/project/ProjectTasks'
import ProjectSettings from './pages/project/ProjectSettings'
import ProjectStats from './pages/project/ProjectStats'
import IssueDetail from './pages/project/IssueDetail'
import PRDetail from './pages/project/PRDetail'
import NewIssue from './pages/project/NewIssue'
import NewPR from './pages/project/NewPR'
import NewTask from './pages/project/NewTask'
import TaskDetail from './pages/project/TaskDetail'
import CommitDetail from './pages/project/CommitDetail'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
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
          <Route path="users/:username" element={<UserProfile />} />
          <Route path="settings" element={<UserSettings />} />
          <Route path=":owner/:repo" element={<ProjectDetail />}>
            <Route index element={<ProjectTree />} />
            <Route path="tree" element={<ProjectTree />} />
            <Route path="tree/*" element={<ProjectTree />} />
            <Route path="issues" element={<ProjectIssues />} />
            <Route path="issues/new" element={<NewIssue />} />
            <Route path="issues/:number" element={<IssueDetail />} />
            <Route path="pull_requests" element={<ProjectMRs />} />
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
    </AuthProvider>
  )
}

export default App
