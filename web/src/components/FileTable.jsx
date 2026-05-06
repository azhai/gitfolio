import React, { useState, useEffect, useCallback } from 'react'
import { Box, Flex, Text, Button, Select, HStack, Spinner } from '@chakra-ui/react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { reposAPI } from '../api/index'
import { timeAgo } from '../i18n/zh'

function formatSize(bytes) {
  if (!bytes || bytes === '0') return '-'
  var n = parseInt(bytes)
  if (isNaN(n)) return bytes
  if (n < 1024) return n + ' B'
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1048576).toFixed(1) + ' MB'
}

function getFileIcon(name, isDir) {
  if (isDir) return { icon: '📁', color: '#54aeff' }
  var lower = (name || '').toLowerCase()
  if (lower === 'dockerfile') return { icon: '🐳', color: '#384d54' }
  if (lower === 'makefile' || lower === 'gnumakefile') return { icon: '🔧', color: '#6d8086' }
  if (lower === '.gitignore') return { icon: '📄', color: '#f54d27' }
  if (lower === '.dockerignore') return { icon: '🐳', color: '#384d54' }
  if (lower === 'license' || lower === 'license.md' || lower === 'license.txt') return { icon: '⚖️', color: '#26aa76' }
  if (lower.startsWith('readme')) return { icon: '📖', color: '#083fa1' }
  if (lower.endsWith('.go')) return { icon: '🔷', color: '#00ADD8' }
  if (lower.endsWith('.rs')) return { icon: '🦀', color: '#DEA584' }
  if (lower.endsWith('.py')) return { icon: '🐍', color: '#3572A5' }
  if (lower.endsWith('.js') || lower.endsWith('.jsx')) return { icon: '📜', color: '#f1e05a' }
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return { icon: '💠', color: '#3178c6' }
  if (lower.endsWith('.java')) return { icon: '☕', color: '#b07219' }
  if (lower.endsWith('.html')) return { icon: '🌐', color: '#e34c26' }
  if (lower.endsWith('.css') || lower.endsWith('.scss')) return { icon: '🎨', color: '#563d7c' }
  if (lower.endsWith('.json')) return { icon: '📋', color: '#292929' }
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return { icon: '⚙️', color: '#cb171e' }
  if (lower.endsWith('.md')) return { icon: '📖', color: '#083fa1' }
  if (lower.endsWith('.sh') || lower.endsWith('.bash')) return { icon: '🖥️', color: '#89e051' }
  if (lower.endsWith('.sql')) return { icon: '🗃️', color: '#e38c00' }
  if (lower.endsWith('.vue')) return { icon: '💚', color: '#41b883' }
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.svg') || lower.endsWith('.webp')) return { icon: '🖼️', color: '#a855f7' }
  if (lower.endsWith('.lock')) return { icon: '🔒', color: '#9ca3af' }
  if (lower.endsWith('.mod')) return { icon: '📦', color: '#00ADD8' }
  if (lower.endsWith('.sum')) return { icon: '✅', color: '#9ca3af' }
  return { icon: '📄', color: '#888' }
}

const FileTable = ({ owner: propOwner, repo: propRepo }) => {
  const navigate = useNavigate()
  const params = useParams()
  const location = useLocation()
  const owner = propOwner || params.owner
  const repo = propRepo || params.repo

  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [branches, setBranches] = useState([])
  const [tags, setTags] = useState([])
  const [currentRef, setCurrentRef] = useState('')

  var basePath = '/' + owner + '/' + repo
  var urlPath = location.pathname.replace(basePath + '/tree/', '').replace(basePath + '/tree', '').replace(basePath, '')
  var currentPath = decodeURIComponent(urlPath || '')

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
      var defaultBranch = branchList.find(function(b) {
        var name = typeof b === 'string' ? b : b.name
        return name === 'main' || name === 'master'
      })
      var ref = typeof defaultBranch === 'string' ? defaultBranch : (defaultBranch && defaultBranch.name) || 'HEAD'
      setCurrentRef(ref)
    })
  }, [owner, repo])

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
    }).catch(function() { setFiles([]) }).finally(function() { setLoading(false) })
  }, [owner, repo, currentRef])

  useEffect(() => {
    if (currentRef) {
      loadTree(currentPath)
    }
  }, [currentRef, currentPath, loadTree])

  function handleRefChange(e) {
    setCurrentRef(e.target.value)
  }

  function handleRowClick(file) {
    if (file.isDir) {
      navigate('/' + owner + '/' + repo + '/tree/' + file.path)
    } else {
      navigate('/' + owner + '/' + repo + '/tree/' + file.path)
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
      <Flex justify="space-between" align="center" px="16px" py="12px" borderBottom="1px solid" borderColor="#f0f0f0">
        <HStack spacing="10px">
          <Select h="30px" w="160px" fontSize="13px" borderColor="#d1d5db" rounded="6px"
            value={currentRef} onChange={handleRefChange}>
            <optgroup label="分支">
              {branches.map(function(b) { return <option key={b} value={b}>{b}</option> })}
            </optgroup>
            <optgroup label="标签">
              {tags.map(function(t) { return <option key={t} value={t}>{t}</option> })}
            </optgroup>
          </Select>
          <Text fontSize="13px" color="#888">{files.length} 个代码</Text>
        </HStack>
        <HStack spacing="8px">
          <Button h="28px" px="12px" fontSize="12px" rounded="6px" bg="#22c55e" color="white" _hover={{ bg: '#16a34a' }}>+ 添加文件</Button>
          <Button h="28px" px="12px" fontSize="12px" rounded="6px" variant="outline" borderColor="#d1d5db" _hover={{ bg: '#f9fafb' }}>+ 新建</Button>
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
              <Text fontSize="13px" w="20px" flexShrink={0} textAlign="center" lineHeight="1">{fi.icon}</Text>
              <Text fontSize="13.5px" fontWeight="500" w="220px" flexShrink={0} ml="8px"
                color={file.isDir ? '#16a34a' : '#333'}
                _hover={{ textDecoration: 'underline' }}>
                {file.name}
              </Text>
              <Text fontSize="13px" color="#888" flex="1" truncate
                overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap"
                mx="16px">
                {file.commitMsg}
              </Text>
              {file.time && (
                <Text fontSize="12px" color="#aaa" w="120px" flexShrink={0} textAlign="right">{file.time}</Text>
              )}
            </Flex>
          )
        })}
      </Box>

      {files.length === 0 && !loading && (
        <Box textAlign="center" py="40px" color="#aaa">
          <Text fontSize="14px">此目录为空</Text>
        </Box>
      )}
    </Box>
  )
}

export default FileTable
