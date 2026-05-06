import React, { useState, useEffect } from 'react'
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

  var basePath = '/' + owner + '/' + repo
  var path = location.pathname

  var pathAfterBase = path.replace(basePath, '')
  if (pathAfterBase.startsWith('/tree/')) {
    pathAfterBase = pathAfterBase.replace('/tree/', '')
  }
  if (pathAfterBase.startsWith('/tree')) {
    pathAfterBase = pathAfterBase.replace('/tree', '')
  }

  var hasExtension = pathAfterBase.lastIndexOf('.') > pathAfterBase.lastIndexOf('/')
  var isFile = hasExtension && pathAfterBase.length > 0

  var isDir = !isFile

  useEffect(() => {
    if (isFile) {
      setReadmePath(null)
      return
    }
    setReadmeLoading(true)
    var dirPath = pathAfterBase || ''
    reposAPI.tree(owner, repo, dirPath).then(function(data) {
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
  }, [owner, repo, pathAfterBase, isFile])

  if (isFile) {
    return <FileViewer />
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
          <FileViewer filePath={readmePath} owner={owner} repo={repo} />
        </Box>
      )}
    </Box>
  )
}

export default ProjectTree
