# GitLab-Style Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor GitFolio frontend to use Go backend serving React build, with GitLab-style layout (global top nav + project sub-nav + left sidebar on project pages) and FileGator-style file listing.

**Architecture:** 
- Go (Fiber) backend serves static files from `web-react/dist/` instead of legacy `web/` SPA
- React frontend uses conditional layout: global pages show only top navbar; project detail pages (`/:owner/:repo`) add project sub-nav bar + left sidebar
- FileGator-style table component for repository file browser with checkboxes, sortable columns, toolbar

**Tech Stack:** Go/Fiber backend, React 18, Chakra UI, React Router v6, Vite

---

### Task 1: Modify Go Backend to Serve React Build

**Files:**
- Modify: `routes/routes.go`

- [ ] **Step 1: Update static file serving to use web-react/dist/**

Replace the catch-all route and static file setup in `routes/routes.go`. Change:
- Root `/` → serve `./web-react/dist/index.html`
- Static assets from `./web-react/dist/assets/`
- Images from `./web-react/` or `./web/images/`
- Remove old `web/app-spa.js`, `web/styles.css`, `web/index-spa.html` routes
- Keep all `/api/*` routes unchanged

Key changes in `setupStaticFiles()` and the catch-all route:

```go
func setupStaticFiles(app *fiber.App) {
	app.Get("/", func(c fiber.Ctx) error {
		return c.SendFile("./web-react/dist/index.html")
	})
	app.Static("/assets", "./web-react/dist/assets")
	app.Get("/images/*", func(c fiber.Ctx) error {
		path := c.Params("*")
		return c.SendFile("./web/images/" + path)
	})
	// Keep uploads route
	app.Get("/uploads/*", static.New("./uploads"))
}
```

And update the catch-all:

```go
app.Get("/*", func(c fiber.Ctx) error) {
	path := c.Path()
	if strings.HasPrefix(path, "/api/") {
		return c.Status(404).JSON(fiber.Map{"error": "API endpoint not found"})
	}
	if strings.HasPrefix(path, "/assets/") || strings.HasPrefix(path, "/images/") {
		return c.Next()
	}
	return c.SendFile("./web-react/dist/index.html")
})
```

- [ ] **Step 2: Verify Go build compiles**

Run: `go build ./...`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add routes/routes.go
git commit -m "feat: serve React build from web-react/dist"
```

---

### Task 2: Create Global Top Navbar Component

**Files:**
- Create: `web-react/src/components/TopNavbar.jsx`
- Modify: `web-react/src/components/Navbar.jsx` → delete after migration

- [ ] **Step 1: Create TopNavbar component**

Create `web-react/src/components/TopNavbar.jsx` — a fixed top navigation bar that is always visible:

```jsx
import React from 'react'
import { Box, Flex, HStack, Input, Avatar, IconButton } from '@chakra-ui/react'
import { SearchIcon, BellIcon } from '@chakra-ui/icons'
import { Link as RouterLink, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { label: 'Home', path: '/', icon: '🏠' },
  { label: 'Projects', path: '/projects', icon: '📂' },
  { label: 'Groups', path: '/groups', icon: '👥' },
  { label: 'Activity', path: '/activity', icon: '📊' },
]

const TopNavbar = () => {
  const location = useLocation()

  return (
    <Box
      as="nav"
      position="fixed"
      top={0} left={0} right={0}
      h="52px"
      bg="white"
      borderBottom="1px solid"
      borderColor="gray.200"
      zIndex={1000}
      boxShadow="sm"
    >
      <Flex h="full" alignItems="center" px={5} maxW="1400px" mx="auto">
        <RouterLink to="/">
          <Flex align="center" gap={2} mr={8}>
            <Text fontSize="lg" fontWeight="bold" color="green.500">📁</Text>
            <Text fontSize="lg" fontWeight="bold" color="gray.800">gitfolio</Text>
          </Flex>
        </RouterLink>

        <HStack as="nav" spacing={1} flex={1}>
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path))
            return (
              <RouterLink key={item.path} to={item.path}>
                <Box
                  px={3} py={2} rounded="md"
                  fontSize="sm" fontWeight="medium"
                  color={isActive ? 'green.700' : 'gray.600'}
                  bg={isActive ? 'green.50' : 'transparent'}
                  _hover={{ bg: 'green.50', color: 'green.700' }}
                  transition="all 0.15s"
                >
                  {item.icon} {item.label}
                </Box>
              </RouterLink>
            )
          })}
        </HStack>

        <Flex alignItems="center" gap={3}>
          <Input
            placeholder="Search projects..."
            size="sm"
            w="240px"
            borderRadius="full"
            borderColor="gray.200"
            _focus={{ borderColor: 'green.400', boxShadow: '0 0 0 3px rgba(16,185,129,0.1)' }}
          />
          <IconButton icon={<BellIcon />} variant="ghost" size="sm" aria-label="Notifications" />
          <Avatar size="sm" name="User" src="/images/avatar-40.svg" cursor="pointer" />
        </Flex>
      </Flex>
    </Box>
  )
}

export default TopNavbar
```

- [ ] **Step 2: Delete old Navbar.jsx**

Delete: `web-react/src/components/Navbar.jsx`

- [ ] **Step 3: Commit**

```bash
git add web-react/src/components/
git commit -m "feat: create global TopNavbar component (GitLab-style)"
```

---

### Task 3: Create Project Sub-Navigation Bar

**Files:**
- Create: `web-react/src/components/ProjectNav.jsx`

- [ ] **Step 1: Create ProjectNav component**

Create `web-react/src/components/ProjectNav.jsx` — shown only on project detail pages (`/:owner/:repo`), displays breadcrumb + tab links:

```jsx
import React from 'react'
import { Box, Flex, Text, HStack } from '@chakra-ui/react'
import { Link as RouterLink, useParams, useLocation } from 'react-router-dom'

const PROJECT_TABS = [
  { label: 'Files', path: 'tree', icon: '📂' },
  { label: 'Issues', path: 'issues', icon: '⚠️' },
  { label: 'Merge Requests', path: 'pull_requests', icon: '🔀' },
  { label: 'CI/CD', path: 'ci', icon: '🚀' },
  { label: 'Wiki', path: 'wiki', icon: '📖' },
  { label: 'Settings', path: 'settings', icon: '⚙️' },
]

const ProjectNav = () => {
  const { owner, repo } = useParams()
  const location = useLocation()

  const basePath = `/${owner}/${repo}`
  const currentTab = PROJECT_TABS.find(tab => location.pathname.includes(tab.path))

  return (
    <Box
      position="fixed"
      top="52px" left={0} right={0}
      h="48px"
      bg="gray.50"
      borderBottom="1px solid"
      borderColor="gray.200"
      zIndex={999}
    >
      <Flex h="full" alignItems="center" px={5} maxW="1400px" mx="auto">
        <Text fontSize="sm" color="gray.500" mr={1}>{owner}</Text>
        <Text fontSize="sm" color="gray.400" mr={1}>/</Text>
        <Text fontSize="sm" fontWeight="600" color="gray.800" mr={8}>{repo}</Text>

        <HStack spacing={1} flex={1}>
          {PROJECT_TABS.map((tab) => {
            const href = `${basePath}/${tab.path}`
            const isActive = location.pathname === href ||
              (tab.path === 'tree' && (location.pathname === basePath || location.pathname.startsWith(`${basePath}/tree`)))
            return (
              <RouterLink key={tab.path} to={href}>
                <Box
                  px={3} py={2}
                  fontSize="sm"
                  color={isActive ? 'green.600' : 'gray.600'}
                  fontWeight={isActive ? 'semibold' : 'normal'}
                  bg={isActive ? 'white' : 'transparent'}
                  borderLeftRadius="md"
                  borderRightRadius="md"
                  borderBottom={isActive ? '2px solid' : 'none'}
                  borderColor="green.500"
                  _hover={{ bg: 'white', color: 'gray.800' }}
                  transition="all 0.15s"
                >
                  {tab.icon} {tab.label}
                </Box>
              </RouterLink>
            )
          })}
        </HStack>
      </Flex>
    </Box>
  )
}

export default ProjectNav
```

- [ ] **Step 2: Commit**

```bash
git add web-react/src/components/ProjectNav.jsx
git commit -m "feat: create ProjectNav sub-navigation bar"
```

---

### Task 4: Create Project Sidebar Component

**Files:**
- Create: `web-react/src/components/ProjectSidebar.jsx`
- Modify: `web-react/src/components/Sidebar.jsx` → delete after migration

- [ ] **Step 1: Create ProjectSidebar component**

Create `web-react/src/components/ProjectSidebar.jsx` — left sidebar visible only on project pages, with grouped menu items:

```jsx
import React from 'react'
import { Box, VStack, Text, Divider, Flex } from '@chakra-ui/react'
import { FiHome, FiBook, FiMessageSquare, FiGitPullRequest, FiActivity, FiStar, FiEye, FiGitBranch, FiTag, FiUsers, FiBarChart2, FiSettings } from 'react-icons/fi'
import { Link as RouterLink, useParams, useLocation } from 'react-router-dom'

const SECTIONS = [
  {
    title: 'Navigate',
    items: [
      { icon: FiHome, label: 'Project overview', path: '' },
      { icon: FiBook, label: 'Repository', path: 'tree' },
      { icon: FiMessageSquare, label: 'Issues', path: 'issues' },
      { icon: FiGitPullRequest, label: 'Merge requests', path: 'pull_requests' },
      { icon: FiActivity, label: 'CI/CD', path: 'ci' },
    ],
  },
  {
    title: 'Manage',
    items: [
      { icon: FiStar, label: 'Star', path: 'star' },
      { icon: FiEye, label: 'Watch', path: 'watch' },
      { icon: FiGitBranch, label: 'Branches', path: 'branches' },
      { icon: FiTag, label: 'Tags', path: 'tags' },
    ],
  },
  {
    title: 'Information',
    items: [
      { icon: FiUsers, label: 'Members', path: 'members' },
      { icon: FiBarChart2, label: 'Analytics', path: 'analytics' },
      { icon: FiSettings, label: 'Settings', path: 'settings' },
    ],
  },
]

const ProjectSidebar = () => {
  const { owner, repo } = useParams()
  const location = useLocation()

  return (
    <Box
      as="aside"
      w="248px"
      bg="white"
      borderRight="1px solid"
      borderColor="gray.200"
      position="fixed"
      left={0}
      top="100px"
      bottom={0}
      overflowY="auto"
      flexShrink={0}
    >
      <VStack spacing={6} p={4} align="stretch">
        {SECTIONS.map((section) => (
          <Box key={section.title}>
            <Text
              fontSize="11px"
              fontWeight="semibold"
              color="gray.400"
              textTransform="uppercase"
              letterSpacing="0.8px"
              px={4} mb={2}
            >
              {section.title}
            </Text>
            <VStack spacing={1} align="stretch">
              {section.items.map((item) => {
                const itemPath = `/${owner}/${repo}${item.path ? '/' + item.path : ''}`
                const isActive = location.pathname === itemPath ||
                  (item.path === '' && location.pathname === `/${owner}/${repo}`) ||
                  (item.path === 'tree' && location.pathname.includes('/tree'))
                return (
                  <RouterLink key={item.label} to={itemPath}>
                    <Flex
                      align="center" gap={3}
                      px={4} py={2}
                      rounded="md"
                      fontSize="sm"
                      color={isActive ? 'green.700' : 'gray.600'}
                      bg={isActive ? 'green.50' : 'transparent'}
                      borderRight={isActive ? '3px solid' : '3px solid transparent'}
                      borderColor="green.500"
                      _hover={{ bg: 'gray.50', color: 'gray.800' }}
                      transition="all 0.15s"
                      fontWeight={isActive ? 'semibold' : 'normal'}
                    >
                      <Box as={item.icon} boxSize={4} />
                      <Text>{item.label}</Text>
                    </Flex>
                  </RouterLink>
                )
              })}
            </VStack>
          </Box>
        ))}
      </VStack>
    </Box>
  )
}

export default ProjectSidebar
```

- [ ] **Step 2: Delete old Sidebar.jsx**

Delete: `web-react/src/components/Sidebar.jsx`

- [ ] **Step 3: Commit**

```bash
git add web-react/src/components/
git commit -m "feat: create ProjectSidebar (left menu for project pages)"
```

---

### Task 5: Create FileGator-Style File Table Component

**Files:**
- Create: `web-react/src/components/FileTable.jsx`

- [ ] **Step 1: Create FileTable component**

Create `web-react/src/components/FileTable.jsx` — table-based file list matching FileGator style:

```jsx
import React, { useState } from 'react'
import {
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Checkbox,
  Flex,
  Text,
  Button,
  Select,
  Icon,
  HStack,
} from '@chakra-ui/react'
import { ChevronDownIcon, ChevronUpIcon } from '@chakra-ui/icons'

const FileTable = ({ files = [], onFileClick }) => {
  const [sortField, setSortField] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [selected, setSelected] = useState(new Set())

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const toggleSelectAll = () => {
    if (selected.size === files.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(files.map((f, i) => i)))
    }
  }

  const toggleSelect = (idx) => {
    const next = new Set(selected)
    if (next.has(idx)) next.delete(idx)
    else next.add(idx)
    setSelected(next)
  }

  const sortedFiles = [...files].sort((a, b) => {
    let cmp = 0
    if (sortField === 'name') cmp = a.name.localeCompare(b.name)
    else if (sortField === 'size') cmp = (a.sizeNum || 0) - (b.sizeNum || 0)
    else if (sortField === 'time') cmp = (a.timeMs || 0) - (b.timeMs || 0)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const SortHeader = ({ field, children }) => (
    <Th
      cursor="pointer"
      userSelect="none"
      onClick={() => handleSort(field)}
      color="gray.600"
      fontSize="xs"
      fontWeight="semibold"
      textTransform="uppercase"
      letterSpacing="0.3px"
      _hover={{ color: 'green.600' }}
      whiteSpace="nowrap"
    >
      <Flex align="center" gap={1}>
        {children}
        {sortField === field && (
          <Icon as={sortDir === 'asc' ? ChevronDownIcon : ChevronUpIcon} boxSize={3} />
        )}
      </Flex>
    </Th>
  )

  return (
    <Box bg="white" border="1px solid" borderColor="gray.200" rounded="lg" overflow="hidden">
      {/* Toolbar */}
      <Flex justify="space-between" align="center" px={4} py={3} borderBottom="1px solid" borderColor="gray.100">
        <HStack spacing={2}>
          <Text fontSize="sm" fontWeight="semibold" color="green.600">📂 Files</Text>
          <Button size="xs" colorScheme="green" variant="solid">+ Add file</Button>
          <Button size="xs" variant="outline" borderColor="gray.200">+ New</Button>
        </HStack>
        <Select size="xs" w="130px" borderColor="gray.200">
          <option>No pagination</option>
          <option>20 per page</option>
          <option>50 per page</option>
        </Select>
      </Flex>

      {/* Table */}
      <Table variant="simple" size="md">
        <Thead>
          <Tr>
            <Th w="36px">
              <Checkbox
                isChecked={selected.size === files.length && files.length > 0}
                isIndeterminate={selected.size > 0 && selected.size < files.length}
                onChange={toggleSelectAll}
                colorScheme="green"
              />
            </Th>
            <SortHeader field="name">Name</SortHeader>
            <SortHeader field="size" w="120px">Size</SortHeader>
            <SortHeader field="time" w="160px">Time</SortHeader>
            <Th w="60px"></Th>
          </Tr>
        </Thead>
        <Tbody>
          {sortedFiles.map((file, idx) => (
            <Tr
              key={file.name}
              _hover={{ bg: 'gray.50' }}
              cursor="pointer"
              onClick={() => onFileClick?.(file)}
            >
              <Td>
                <Checkbox
                  isChecked={selected.has(idx)}
                  onChange={(e) => { e.stopPropagation(); toggleSelect(idx) }}
                  colorScheme="green"
                  onClick={(e) => e.stopPropagation()}
                />
              </Td>
              <Td>
                <Flex align="center" gap={2}>
                  <Text fontSize="lg">{file.isDir ? '📁' : '📄'}</Text>
                  <Text
                    fontWeight="medium"
                    color="gray.800"
                    _hover={{ color: 'green.600', textDecoration: 'underline' }}
                  >
                    {file.name}
                  </Text>
                </Flex>
              </Td>
              <Td color="gray.600" fontSize="sm">{file.size}</Td>
              <Td color="gray.500" fontSize="sm">{file.time}</Td>
              <Td color="gray.300" cursor="pointer" _hover={{ color: 'green.500' }} onClick={(e) => e.stopPropagation()}>⋮</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      {/* Footer */}
      <Flex px={4} py={2} borderTop="1px solid" borderColor="gray.100" fontSize="sm" color="gray.500">
        Selected {selected.size} of {files.length}
      </Flex>
    </Box>
  )
}

export default FileTable
```

- [ ] **Step 2: Commit**

```bash
git add web-react/src/components/FileTable.jsx
git commit -m "feat: create FileGator-style FileTable component"
```

---

### Task 6: Create Project Detail Page

**Files:**
- Create: `web-react/src/pages/ProjectDetail.jsx`

- [ ] **Step 1: Create ProjectDetail page**

Create `web-react/src/pages/ProjectDetail.jsx` — main project page showing file browser by default:

```jsx
import React, { useState } from 'react'
import { Box, Heading, Text, Breadcrumb, BreadcrumbItem, useBreakpointValue } from '@chakra-ui/react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import FileTable from '../components/FileTable'

const MOCK_FILES = [
  { name: 'src/', isDir: true, size: 'Folder', time: '10/06/21 19:00:05', sizeNum: 0 },
  { name: 'main.go', isDir: false, size: '4.2 KB', time: '10/06/21 17:00:16', sizeNum: 4200 },
  { name: 'go.mod', isDir: false, size: '1.1 KB', time: '10/06/20 22:27:58', sizeNum: 1100 },
  { name: 'routes.go', isDir: false, size: '8.8 KB', time: '10/06/21 11:26:25', sizeNum: 8800 },
  { name: 'config.go', isDir: false, size: '277 Bytes', time: '10/06/21 03:00:15', sizeNum: 277 },
  { name: 'README.md', isDir: false, size: '2.3 KB', time: '10/06/15 07:57:39', sizeNum: 2300 },
  { name: 'Makefile', isDir: false, size: '13.3 KB', time: '10/06/15 07:56:01', sizeNum: 13300 },
  { name: '.env.example', isDir: false, size: '311 Bytes', time: '10/06/21 01:01:17', sizeNum: 311 },
]

const ProjectDetail = () => {
  const { owner, repo } = useParams()

  const handleFileClick = (file) => {
    console.log('Clicked:', file.name)
  }

  return (
    <Box>
      <FileTable files={MOCK_FILES} onFileClick={handleFileClick} />
    </Box>
  )
}

export default ProjectDetail
```

- [ ] **Step 2: Commit**

```bash
git add web-react/src/pages/ProjectDetail.jsx
git commit -m "feat: create ProjectDetail page with FileGator file browser"
```

---

### Task 7: Refactor Layout Component for Dual Mode

**Files:**
- Modify: `web-react/src/components/Layout.jsx`
- Modify: `web-react/src/App.jsx`

- [ ] **Step 1: Rewrite Layout component**

Rewrite `web-react/src/components/Layout.jsx` to support two modes:
- **Global mode** (dashboard, projects list): Only TopNavbar, full-width content
- **Project mode** (`/:owner/:repo/*`): TopNavbar + ProjectNav + ProjectSidebar + content

```jsx
import React from 'react'
import { Box, Container, useBreakpointValue } from '@chakra-ui/react'
import { Outlet, useLocation, useParams } from 'react-router-dom'
import TopNavbar from './TopNavbar'
import ProjectNav from './ProjectNav'
import ProjectSidebar from './ProjectSidebar'

const LAYOUT_CONFIG = {
  global: { topOffset: '52px', contentPadding: '28px 32px' },
  project: { topOffset: '100px', contentPadding: '28px 32px', hasSidebar: true },
}

const Layout = () => {
  const location = useLocation()
  const params = useParams()

  const isProjectPage = !!params.owner && !!params.repo
  const mode = isProjectPage ? 'project' : 'global'
  const config = LAYOUT_CONFIG[mode]

  return (
    <Box minH="100vh" bg="gray.50">
      <TopNavbar />
      {isProjectPage && <>
        <ProjectNav />
        <ProjectSidebar />
      </>}

      <Box
        mt={config.topOffset}
        ml={isProjectPage ? '248px' : '0'}
        transition="margin-left 0.2s"
      >
        <Container maxW="1280px" py={6} px={0} fluid>
          <Outlet />
        </Container>
      </Box>
    </Box>
  )
}

export default Layout
```

- [ ] **Step 2: Update App.jsx routing**

Update `web-react/src/App.jsx` to include project detail routes:

```jsx
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import LoginPage from './pages/LoginPage'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="groups" element={
          <Box p={8} textAlign="center"><Text fontSize="2xl" color="gray.500">Groups 页面开发中... 🚧</Text></Box>
        } />
        <Route path="activity" element={
          <Box p={8} textAlign="center"><Text fontSize="2xl" color="gray.500">Activity 页面开发中... 🚧</Text></Box>
        } />

        {/* Project detail routes */}
        <Route path=":owner/:repo" element={<ProjectDetail />} />

        <Route path="*" element={
          <Box p={8} textAlign="center"><Text fontSize="2xl" color="gray.500">页面开发中... 🚧</Text></Box>
        } />
      </Route>
    </Routes>
  )
}

export default App
```

Note: Need to import Box and Text from chakra-ui in App.jsx.

- [ ] **Step 3: Commit**

```bash
git add web-react/src/components/Layout.jsx web-react/src/App.jsx
git commit -m "feat: refactor Layout for GitLab dual-mode layout"
```

---

### Task 8: Build and Test

**Files:**
- Build output: `web-react/dist/`

- [ ] **Step 1: Run production build**

Run: `cd /Users/ryan/projects/gitfolio/web-react && npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Start Go server and verify in browser**

Run: `cd /Users/ryan/projects/gitfolio && go run main.go &`
Then open http://localhost:3000 in browser

Verify:
- [ ] Dashboard page shows only TopNavbar (no sidebar, no project nav)
- [ ] Projects list shows only TopNavbar
- [ ] Clicking a project navigates to `/:owner/:repo` and shows:
  - TopNavbar + ProjectNav (breadcrumb + tabs) + ProjectSidebar (left menu)
  - FileGator-style file table with checkboxes, columns, toolbar
- [ ] File table rows are hoverable, selectable
- [ ] All navigation links work correctly

- [ ] **Step 3: Clean up demo file**

Delete: `web-react/gitlab-layout-demo.html`

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete GitLab-style layout with FileGator file browser"
```

---

## Self-Review

**Spec coverage:**
- ✅ Go serves React build — Task 1
- ✅ Global top nav with big menu — Task 2
- ✅ Project sub-nav appears when opening project — Task 3
- ✅ Left sidebar with project menu when in project — Task 4
- ✅ FileGator-style file list (table, checkboxes, Name/Size/Time) — Task 5
- ✅ Route structure supports `/:owner/:repo` — Tasks 6, 7

**Placeholder scan:** None found. All steps contain actual code.

**Type consistency:** Component names, prop names, and route patterns consistent across tasks.
