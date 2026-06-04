import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { Box, Spinner, Flex, Text, Button, Tooltip, useBreakpointValue } from '@chakra-ui/react'
import FileTable from '../../components/FileTable'
import FileViewer from './FileViewer'
import { reposAPI } from '../../api/index'
import { GitWorkflowProvider } from '../../contexts/GitWorkflowContext'
import WorkingPanel from '../../components/gitworkflow/working_panel'
import ConflictBanner from '../../components/gitworkflow/conflict_banner'
import { t } from '../../i18n/index'

const ProjectTree = () => {
  const { owner, repo } = useParams()
  const location = useLocation()
  const [readmePath, setReadmePath] = useState(null)
  const [readmeLoading, setReadmeLoading] = useState(false)
  const [refNames, setRefNames] = useState([])
  const [repoInfo, setRepoInfo] = useState(null)
  const [panelCollapsed, setPanelCollapsed] = useState(false)

  var basePath = '/' + owner + '/' + repo
  var path = location.pathname

  var pathAfterBase = path.replace(basePath, '')
  if (pathAfterBase.startsWith('/tree/')) {
    pathAfterBase = pathAfterBase.replace('/tree/', '')
  }
  if (pathAfterBase.startsWith('/tree')) {
    pathAfterBase = pathAfterBase.replace('/tree', '')
  }

  useEffect(function() {
    reposAPI.get(owner, repo).then(function(data) { setRepoInfo(data) }).catch(function() {})
  }, [owner, repo])

  useEffect(function() {
    Promise.all([
      reposAPI.branches(owner, repo).catch(function() { return [] }),
      reposAPI.tags(owner, repo).catch(function() { return [] }),
    ]).then(function([branchData, tagData]) {
      var branchList = Array.isArray(branchData && branchData.branches ? branchData.branches : branchData)
        ? (branchData.branches || branchData) : []
      var tagList = Array.isArray(tagData && tagData.tags ? tagData.tags : tagData)
        ? (tagData.tags || tagData) : []
      var names = []
        .concat(branchList.map(function(b) { return typeof b === 'string' ? b : (b.name || '') }))
        .concat(tagList.map(function(t) { return typeof t === 'string' ? t : (t.name || '') }))
      setRefNames(names)
    })
  }, [owner, repo])

  var parsed = useMemo(function() {
    if (!pathAfterBase) return { ref: '', filePath: '' }
    var firstSegment = pathAfterBase.split('/')[0]
    if (refNames.indexOf(firstSegment) >= 0) {
      return { ref: firstSegment, filePath: pathAfterBase.substring(firstSegment.length + 1) }
    }
    return { ref: '', filePath: pathAfterBase }
  }, [pathAfterBase, refNames])

  var hasExtension = parsed.filePath.lastIndexOf('.') > parsed.filePath.lastIndexOf('/')
  var isFile = hasExtension && parsed.filePath.length > 0
  var isDir = !isFile

  useEffect(() => {
    if (isFile) {
      setReadmePath(null)
      return
    }
    setReadmeLoading(true)
    var dirPath = parsed.filePath || ''
    var useRef = parsed.ref || 'HEAD'
    reposAPI.tree(owner, repo, dirPath, useRef).then(function(data) {
      var entries = data && Array.isArray(data.entries) ? data.entries : []
      var readme = entries.find(function(e) {
        var n = (e.name || '').toLowerCase()
        return n === 'readme.md' || n === 'readme' || n === 'readme.txt' || n === 'readme.markdown'
      })
      if (readme) {
        var fullPath = dirPath ? dirPath + '/' + readme.name : readme.name
        setReadmePath(fullPath)
      } else {
        setReadmePath(null)
      }
    }).catch(function() { setReadmePath(null) }).finally(function() { setReadmeLoading(false) })
  }, [owner, repo, parsed.filePath, parsed.ref, isFile])

  if (isFile) {
    return <FileViewer filePath={parsed.filePath} owner={owner} repo={repo} branchRef={parsed.ref || 'HEAD'} />
  }

  var hasLocalPath = repoInfo && repoInfo.local_path

  return (
    <GitWorkflowProvider owner={owner} repo={repo}>
      <Box>
        {hasLocalPath && <ConflictBanner />}
        <Flex gap="0" direction={{ base: 'column', md: 'row' }} position="relative">
          <Box flex={{ base: '1', md: hasLocalPath && !panelCollapsed ? '0 0 60%' : '1', lg: hasLocalPath && !panelCollapsed ? '0 0 60%' : '1' }}>
            <FileTable />
            {isDir && readmeLoading && (
              <Box display="flex" justifyContent="center" py="20px">
                <Spinner size="md" color="#22c55e" />
              </Box>
            )}
            {isDir && readmePath && !readmeLoading && (
              <Box mt="20px">
                <FileViewer filePath={readmePath} owner={owner} repo={repo} branchRef={parsed.ref || 'HEAD'} />
              </Box>
            )}
          </Box>
          {hasLocalPath && !panelCollapsed && (
            <Box flex={{ base: '1', md: '0 0 38%', lg: '0 0 38%' }} bg="white" border="1px solid" borderColor="#e5e7eb" rounded="8px" p="12px" maxH="80vh" overflowY="auto" ml="12px">
              <Flex justify="space-between" align="center" mb="8px">
                <Text fontSize="13px" fontWeight="600" color="#374151">{t('gitWorkflow.workingPanel')}</Text>
                <Tooltip label={t('gitWorkflow.collapsePanel')} placement="left" hasArrow>
                  <Button h="20px" w="20px" p="0" minW="20px" fontSize="14px" rounded="4px"
                    variant="ghost" color="#9ca3af" _hover={{ bg: '#f3f4f6', color: '#6b7280' }}
                    onClick={function() { setPanelCollapsed(true) }}>
                    ▸
                  </Button>
                </Tooltip>
              </Flex>
              <WorkingPanel />
            </Box>
          )}
          {hasLocalPath && panelCollapsed && (
            <Tooltip label={t('gitWorkflow.expandPanel')} placement="left" hasArrow>
              <Box
                w="18px" minH="60px" bg="#f9fafb" border="1px solid" borderColor="#e5e7eb"
                borderLeft="none" roundedRight="6px" cursor="pointer"
                display="flex" alignItems="center" justifyContent="center"
                _hover={{ bg: '#f0fdf4', borderColor: '#86efac' }}
                onClick={function() { setPanelCollapsed(false) }}
                ml="4px">
                <Text fontSize="11px" color="#9ca3af" writingMode="vertical-rl" userSelect="none">
                  {t('gitWorkflow.workingPanel')}
                </Text>
              </Box>
            </Tooltip>
          )}
        </Flex>
      </Box>
    </GitWorkflowProvider>
  )
}

export default ProjectTree
