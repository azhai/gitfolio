import React from 'react'
import { Box, Text, Link } from '@chakra-ui/react'
import { Outlet, useParams, useLocation } from 'react-router-dom'
import TopNavbar from './TopNavbar'
import ProjectSidebar from './ProjectSidebar'

function isFileViewPath(pathname, owner, repo) {
  if (!owner || !repo) return false
  var prefix = '/' + owner + '/' + repo + '/tree/'
  if (!pathname.startsWith(prefix)) return false
  var rest = pathname.slice(prefix.length)
  if (!rest) return false
  var lastPart = rest.split('/').pop()
  var dotIdx = lastPart.lastIndexOf('.')
  if (dotIdx <= 0) return false
  var ext = lastPart.slice(dotIdx + 1).toLowerCase()
  var codeExts = ['go', 'js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'rs', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'html', 'css', 'scss', 'less', 'json', 'xml', 'yaml', 'yml', 'md', 'sql', 'sh', 'bash', 'php', 'swift', 'kt', 'scala', 'r', 'lua', 'vim', 'toml', 'ini', 'conf', 'cfg', 'txt', 'env', 'gitignore', 'dockerignore', 'eslintrc', 'prettierrc', 'editorconfig', 'babelrc', 'properties', 'gradle', 'cmake', 'make', 'dockerfile']
  return codeExts.indexOf(ext) >= 0 || lastPart.toLowerCase() === 'dockerfile' || lastPart.toLowerCase() === 'makefile' || lastPart.toLowerCase() === 'gnumakefile' || lastPart.startsWith('.')
}

const Layout = () => {
  const params = useParams()
  const location = useLocation()
  const isProjectPage = !!params.owner && !!params.repo
  const hideSidebar = isFileViewPath(location.pathname, params.owner, params.repo)

  return (
    <Box minH="100vh" bg="#f5f5f5">
      <TopNavbar />
      {isProjectPage && !hideSidebar && <ProjectSidebar />}

      <Box
        mt="52px"
        ml={isProjectPage && !hideSidebar ? '248px' : '0'}
        transition="margin-left 0.2s"
        p="28px 32px"
        maxW="1280px"
        mx="auto"
        minH="calc(100vh - 52px)"
      >
        <Outlet />
      </Box>
      <Box
        as="footer"
        ml={isProjectPage && !hideSidebar ? '248px' : '0'}
        py="16px"
        textAlign="center"
        bg="#f5f5f5"
      >
        <Text fontSize="12px" color="gray.400">
          <Link href="https://beian.miit.gov.cn/" target="_blank" rel="noopener" _hover={{ color: 'gray.600' }}>
            粤ICP备2026052659号-1
          </Link>
        </Text>
      </Box>
    </Box>
  )
}

export default Layout
