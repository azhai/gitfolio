import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { Box, Spinner } from '@chakra-ui/react'
import FileTable from '../../components/FileTable'
import FileViewer from './FileViewer'
import { reposAPI } from '../../api/index'

const ProjectTree = () => {
  const { owner, repo } = useParams()
  const location = useLocation()
  const [readmePath, setReadmePath] = useState(null)
  const [readmeLoading, setReadmeLoading] = useState(false)
  const [refNames, setRefNames] = useState([])

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

  return (
    <Box>
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
  )
}

export default ProjectTree
