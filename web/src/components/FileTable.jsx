import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Box, Flex, Text, Input, HStack, Spinner, Menu, MenuButton, MenuList, MenuItem, Tabs, TabList, Tab, Button } from '@chakra-ui/react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { reposAPI } from '../api/index'
import { t, timeAgo } from '../i18n/index'
import { FileIcons, IconMap } from '../components/Icons'

function getFileIcon(name, isDir) {
  if (isDir) {
    var folder = FileIcons.find(function(f) { return f.isDir })
    if (folder) return { Comp: folder.icon, color: folder.color }
    return { color: '#54aeff' }
  }
  var lower = (name || '').toLowerCase()
  for (var i = 0; i < FileIcons.length; i++) {
    var fi = FileIcons[i]
    if (fi.isDir) continue
    for (var j = 0; j < fi.exts.length; j++) {
      if (lower === fi.exts[j] || lower.endsWith(fi.exts[j])) {
        return { Comp: fi.icon, color: fi.color }
      }
    }
  }
  return { color: '#888' }
}

function formatSize(size) {
  if (!size || size === '-') return ''
  var num = parseInt(size, 10)
  if (isNaN(num) || num === 0) return ''
  if (num < 1024) return num + ' B'
  if (num < 1024 * 1024) return (num / 1024).toFixed(1) + ' KB'
  if (num < 1024 * 1024 * 1024) return (num / (1024 * 1024)).toFixed(1) + ' MB'
  return (num / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
}

function FileIconComp({ name, size = 15, color: iconColor }) {
  var result = typeof name === 'string' ? null : name
  if (result && result.Comp) {
    var C = result.Comp
    return <C size={size} strokeWidth={2} color={iconColor || result.color || '#888'} />
  }
  return <Text fontSize={size} color={iconColor || '#888'}>{typeof name === 'string' ? name : '📄'}</Text>
}

const FileTable = ({ owner: propOwner, repo: propRepo }) => {
  var BranchIcon = IconMap.branch
  var TagIcon = IconMap.tag
  var PlusIcon = IconMap.plus
  var FileIcon = IconMap.fileCode
  var UploadIcon = IconMap.upload
  var IssueIcon = IconMap.issue
  var PRIcon = IconMap.pr
  const navigate = useNavigate()
  const params = useParams()
  const location = useLocation()
  const owner = propOwner || params.owner
  const repo = propRepo || params.repo

  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [branches, setBranches] = useState([])
  const [tags, setTags] = useState([])
  const [currentRef, setCurrentRef] = useState('')
  const [lastCommit, setLastCommit] = useState(null)
  const [refTab, setRefTab] = useState('branches')
  const [refSearch, setRefSearch] = useState('')
  const [commitExpanded, setCommitExpanded] = useState(false)
  const [commitOverflow, setCommitOverflow] = useState(false)
  const commitTextRef = useRef(null)

  var basePath = '/' + owner + '/' + repo
  var urlPath = location.pathname.replace(basePath + '/tree/', '').replace(basePath + '/tree', '').replace(basePath, '')
  var decodedUrlPath = decodeURIComponent(urlPath || '')

  var parsedUrl = useMemo(function() {
    if (!decodedUrlPath) return { ref: '', path: '' }
    var firstSegment = decodedUrlPath.split('/')[0]
    if (branches.indexOf(firstSegment) >= 0 || tags.indexOf(firstSegment) >= 0) {
      return { ref: firstSegment, path: decodedUrlPath.substring(firstSegment.length + 1) }
    }
    return { ref: '', path: decodedUrlPath }
  }, [decodedUrlPath, branches, tags])

  var currentPath = parsedUrl.path

  useEffect(() => {
    Promise.all([
      reposAPI.branches(owner, repo).catch(function() { return [] }),
      reposAPI.tags(owner, repo).catch(function() { return [] }),
    ]).then(function([branchData, tagData]) {
      var branchList = Array.isArray(branchData && branchData.branches ? branchData.branches : branchData)
        ? (branchData.branches || branchData) : []
      var tagList = Array.isArray(tagData && tagData.tags ? tagData.tags : tagData)
        ? (tagData.tags || tagData) : []
      setBranches(branchList.map(function(b) { return typeof b === 'string' ? b : (b.name || '') }))
      setTags(tagList.map(function(t) { return typeof t === 'string' ? t : (t.name || '') }))

      var decodedUrl = decodeURIComponent(urlPath || '')
      var firstSeg = decodedUrl ? decodedUrl.split('/')[0] : ''
      var allRefs = []
        .concat(branchList.map(function(b) { return typeof b === 'string' ? b : (b.name || '') }))
        .concat(tagList.map(function(t) { return typeof t === 'string' ? t : (t.name || '') }))

      if (firstSeg && allRefs.indexOf(firstSeg) >= 0) {
        setCurrentRef(firstSeg)
      } else {
        var defaultBranch = branchList.find(function(b) {
          var name = typeof b === 'string' ? b : b.name
          return name === 'main' || name === 'master'
        })
        var ref = typeof defaultBranch === 'string' ? defaultBranch : (defaultBranch && defaultBranch.name) || 'HEAD'
        setCurrentRef(ref)
      }
    })
  }, [owner, repo])

  useEffect(function() {
    if (parsedUrl.ref) {
      setCurrentRef(parsedUrl.ref)
    }
  }, [parsedUrl.ref])

  useEffect(function() {
    if (!currentRef) return
    reposAPI.lastCommit(owner, repo, currentRef).then(function(commitData) {
      console.log('[FileTable] lastCommit data:', commitData)
      setLastCommit(commitData || null)
    }).catch(function(err) {
      console.error('[FileTable] lastCommit error:', err)
      setLastCommit(null)
    })
  }, [owner, repo, currentRef])

  useEffect(function() {
    setCommitExpanded(false)
    if (lastCommit && lastCommit.message && commitTextRef.current) {
      var el = commitTextRef.current
      setCommitOverflow(el.scrollWidth > el.clientWidth)
    } else {
      setCommitOverflow(false)
    }
  }, [lastCommit])

  const loadTree = useCallback(function(path, ref) {
    setLoading(true)
    var useRef = ref || currentRef || 'HEAD'
    reposAPI.tree(owner, repo, path, useRef).then(function(data) {
      var entries = []
      if (data && Array.isArray(data.entries)) {
        entries = data.entries.map(function(e) {
          return {
            name: e.name || '',
            isDir: e.type === 'tree' || e.type === 'dir',
            size: formatSize(e.size),
            commitMsg: e.last_commit_message || e.commit_message || '',
            time: (e.last_commit_time || e.commit_time) ? timeAgo(e.last_commit_time || e.commit_time) : '',
            path: (path ? path + '/' : '') + e.name,
          }
        })
      }
      entries.sort(function(a, b) {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      setFiles(entries)
      setError(null)
    }).catch(function(err) {
      console.error('[FileTable] Failed to load tree:', err)
      setFiles([])
      setError(err.message || t('fileTable.loadFailed'))
    }).finally(function() { setLoading(false) })
  }, [owner, repo, currentRef])

  useEffect(() => {
    if (currentRef) {
      loadTree(currentPath)
    }
  }, [currentRef, currentPath, loadTree])

  function handleRowClick(file) {
    var refPrefix = currentRef ? currentRef + '/' : ''
    if (file.isDir) {
      navigate('/' + owner + '/' + repo + '/tree/' + refPrefix + file.path)
    } else {
      navigate('/' + owner + '/' + repo + '/tree/' + refPrefix + file.path)
    }
  }

  var breadcrumbs = currentPath.split('/').filter(Boolean)

  if (loading && files.length === 0) {
    return (
      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="60px">
        <Box display="flex" justifyContent="center">
          <Spinner size="lg" color="#22c55e" />
        </Box>
      </Box>
    )
  }

  return (
    <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" overflow="hidden">
      <Flex align="center" px="16px" py="10px" borderBottom="1px solid" borderColor="#f0f0f0" justify="space-between">
        <Menu placement="bottom-start" onClose={function() { setRefSearch('') }}>
          <MenuButton as={Button}
            h="30px" px="10px" fontSize="13px" fontWeight="500"
            bg="#f6f8fa" border="1px solid" borderColor="#d1d5db" rounded="6px"
            color="#333" _hover={{ bg: '#eff2f5' }} _active={{ bg: '#eff2f5' }}
            rightIcon={null}
            leftIcon={(branches.indexOf(currentRef) >= 0 ? <BranchIcon size={14} color="#555" /> : <TagIcon size={14} color="#555" />)}>
            <HStack gap="4px" display="inline-flex">
              <Text>{currentRef || 'HEAD'}</Text>
              <Text color="#888" fontSize="11px">▾</Text>
            </HStack>
          </MenuButton>
          <MenuList minW="280px" p="0" overflow="hidden" borderColor="#d1d5db">
            <Box px="8px" pt="8px" pb="4px">
              <Input h="30px" fontSize="13px" placeholder={t('fileTable.filterRef')}
                value={refSearch} onChange={function(e) { setRefSearch(e.target.value) }}
                borderColor="#d1d5db" _focus={{ borderColor: '#16a34a', boxShadow: '0 0 0 1px #16a34a' }} />
            </Box>
            <Tabs index={refTab === 'branches' ? 0 : 1} onChange={function(i) { setRefTab(i === 0 ? 'branches' : 'tags'); setRefSearch('') }} colorScheme="green" size="sm">
              <TabList px="8px" borderBottom="1px solid" borderColor="#e5e7eb">
                <Tab fontSize="12px" px="10px" py="4px" _selected={{ color: '#16a34a', borderColor: '#16a34a' }}>{t('fileTable.branches')}</Tab>
                <Tab fontSize="12px" px="10px" py="4px" _selected={{ color: '#16a34a', borderColor: '#16a34a' }}>{t('fileTable.tags')}</Tab>
              </TabList>
            </Tabs>
            <Box maxH="240px" overflowY="auto">
              {(refTab === 'branches' ? branches : tags)
                .filter(function(item) { return !refSearch || item.toLowerCase().indexOf(refSearch.toLowerCase()) >= 0 })
                .map(function(item) {
                  var isActive = item === currentRef
                  return (
                    <MenuItem key={item}
                      fontSize="13px" py="6px" px="12px"
                      bg={isActive ? '#f0fdf4' : 'transparent'}
                      color={isActive ? '#16a34a' : '#333'}
                      fontWeight={isActive ? '600' : 'normal'}
                      _hover={{ bg: '#f0fdf4' }}
                      onClick={function() { navigate('/' + owner + '/' + repo + '/tree/' + item) }}
                      icon={refTab === 'branches' ? <BranchIcon size={14} color={isActive ? '#16a34a' : '#888'} /> : <TagIcon size={14} color={isActive ? '#16a34a' : '#888'} />}>
                      {item}
                    </MenuItem>
                  )
                })}
              {(refTab === 'branches' ? branches : tags)
                .filter(function(item) { return !refSearch || item.toLowerCase().indexOf(refSearch.toLowerCase()) >= 0 }).length === 0 && (
                <Text fontSize="12px" color="#aaa" py="16px" textAlign="center">
                  {refSearch ? t('fileTable.noMatch') : (refTab === 'branches' ? t('fileTable.noBranches') : t('fileTable.noTags'))}
                </Text>
              )}
            </Box>
          </MenuList>
        </Menu>
        {lastCommit && (
          <HStack gap="10px" flex="1" ml="16px" minW={0}>
            {lastCommit.hash && (
              <Text fontSize="12px" color="#16a34a" fontFamily="monospace" flexShrink={0}
                bg="#f0fdf4" px="6px" py="1px" rounded="4px" fontWeight="500">
                {lastCommit.hash}
              </Text>
            )}
            {lastCommit.author && (
              <Text fontSize="13px" color="#555" fontWeight="500" flexShrink={0}>
                {lastCommit.author}
              </Text>
            )}
            <Text ref={commitTextRef} fontSize="13px" color="#888" noOfLines={commitExpanded ? undefined : 1}
              flex="1" minW={0}
              overflow={commitExpanded ? 'visible' : 'hidden'} textOverflow="ellipsis" whiteSpace={commitExpanded ? 'normal' : 'nowrap'}>
              {lastCommit.message || ''}
            </Text>
            {commitOverflow && !commitExpanded && (
              <Text fontSize="12px" color="#16a34a" cursor="pointer" flexShrink={0}
                onClick={function(e) { e.stopPropagation(); setCommitExpanded(true) }}
                _hover={{ textDecoration: 'underline' }}>
                {t('fileTable.expand')}
              </Text>
            )}
            {commitExpanded && (
              <Text fontSize="12px" color="#16a34a" cursor="pointer" flexShrink={0}
                onClick={function(e) { e.stopPropagation(); setCommitExpanded(false) }}
                _hover={{ textDecoration: 'underline' }}>
                {t('fileTable.collapse')}
              </Text>
            )}
            {lastCommit.time && (
              <Text fontSize="12px" color="#aaa" whiteSpace="nowrap" flexShrink={0}>
                {timeAgo(lastCommit.time)}
              </Text>
            )}
          </HStack>
        )}
        <HStack gap="6px" flexShrink={0} ml="16px">
          <Menu placement="bottom-end">
            <MenuButton as={Button}
              h="28px" px="10px" fontSize="12px" rounded="6px"
              bg="#f6f8fa" border="1px solid" borderColor="#d1d5db" color="#555"
              _hover={{ bg: '#eff2f5' }} _active={{ bg: '#eff2f5' }}
              rightIcon={<Text fontSize="10px" ml="2px">▾</Text>}
              leftIcon={<PlusIcon size={12} />}>
              {t('fileTable.addFile')}
            </MenuButton>
            <MenuList minW="160px" borderColor="#d1d5db">
              <MenuItem fontSize="13px" py="6px"
                onClick={function() { navigate('/' + owner + '/' + repo + '/tree/new') }}
                icon={<FileIcon size={14} color="#888" />}>
                {t('fileTable.createNewFile')}
              </MenuItem>
              <MenuItem fontSize="13px" py="6px"
                onClick={function() { navigate('/' + owner + '/' + repo + '/tree/upload') }}
                icon={<UploadIcon size={14} color="#888" />}>
                {t('fileTable.uploadFile')}
              </MenuItem>
            </MenuList>
          </Menu>
          <Menu placement="bottom-end">
            <MenuButton as={Button}
              h="28px" px="10px" fontSize="12px" rounded="6px"
              bg="#16a34a" color="white"
              _hover={{ bg: '#15803d' }} _active={{ bg: '#15803d' }}
              rightIcon={<Text fontSize="10px" ml="2px">▾</Text>}
              leftIcon={<PlusIcon size={12} />}>
              {t('fileTable.newBtn')}
            </MenuButton>
            <MenuList minW="160px" borderColor="#d1d5db">
              <MenuItem fontSize="13px" py="6px"
                onClick={function() { navigate('/' + owner + '/' + repo + '/issues/new') }}
                icon={<IssueIcon size={14} color="#888" />}>
                {t('fileTable.newIssue')}
              </MenuItem>
              <MenuItem fontSize="13px" py="6px"
                onClick={function() { navigate('/' + owner + '/' + repo + '/pull_requests/new') }}
                icon={<PRIcon size={14} color="#888" />}>
                {t('fileTable.newMR')}
              </MenuItem>
            </MenuList>
          </Menu>
        </HStack>
      </Flex>

      {breadcrumbs.length > 0 && (
        <Flex px="16px" py="8px" gap="6px" fontSize="13px" borderBottom="1px solid" borderColor="#f0f0f0" align="center">
          <Text cursor="pointer" color="#16a34a" fontWeight="500" onClick={function() { navigate('/' + owner + '/' + repo + '/tree') }} _hover={{ textDecoration: 'underline' }}>
            {owner}/{repo}
          </Text>
          {breadcrumbs.map(function(bc, i) {
            var path = breadcrumbs.slice(0, i + 1).join('/')
            var isLast = i === breadcrumbs.length - 1
            return (
              <React.Fragment key={i}>
                <Text color="#ccc">/</Text>
                <Text
                  cursor={isLast ? 'default' : 'pointer'}
                  color={isLast ? '#333' : '#16a34a'}
                  fontWeight={isLast ? '500' : 'normal'}
                  onClick={function() { !isLast && navigate('/' + owner + '/' + repo + '/tree/' + path) }}
                  _hover={!isLast ? { textDecoration: 'underline' } : {}}
                >{bc}</Text>
              </React.Fragment>
            )
          })}
        </Flex>
      )}

      <Box>
        {files.map(function(file) {
          var fi = getFileIcon(file.name, file.isDir)
          return (
            <Flex key={file.path || file.name}
              align="center" px="16px" py="7px"
              cursor="pointer" transition="background-color 0.15s"
              _hover={{ bg: '#f9fafb' }}
              borderBottom="1px solid #f5f5f5"
              onClick={function() { handleRowClick(file) }}>
              <Box w="20px" flexShrink={0} textAlign="center" lineHeight="1">
                <FileIconComp name={fi} size={14} color={fi.color} />
              </Box>
              <Text fontSize="13.5px" fontWeight="500" w="220px" flexShrink={0} ml="8px"
                color={file.isDir ? '#16a34a' : '#333'}
                _hover={{ textDecoration: 'underline' }}>
                {file.name}
              </Text>
              <Text fontSize="13px" color="#888" flex="1" truncate
                overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap"
                mx="16px" textAlign="left">
                {file.commitMsg}
              </Text>
              {file.time && (
                <Text fontSize="12px" color="#aaa" w="120px" flexShrink={0} textAlign="left">{file.time}</Text>
              )}
            </Flex>
          )
        })}
      </Box>

      {files.length === 0 && !loading && (
        <Box textAlign="center" py="40px" color="#aaa">
          {error ? (
            <>
              <Text fontSize="14px" color="#dc2626" mb="2">{t('fileTable.loadFailed')}</Text>
              <Text fontSize="12px">{error}</Text>
            </>
          ) : (
            <Text fontSize="14px">{t('fileTable.emptyDir')}</Text>
          )}
        </Box>
      )}
    </Box>
  )
}

export default FileTable
