import React, { useState, useEffect } from 'react'
import { Box, Text, Flex, VStack, HStack, Badge, Spinner, Button } from '@chakra-ui/react'
import { useParams } from 'react-router-dom'
import { reposAPI } from '../../api/index'

var PAGE_SIZE = 20

function PaginationBar(_ref) {
  var page = _ref.page
  var totalPages = _ref.totalPages
  var onPageChange = _ref.onPageChange

  if (totalPages <= 1) return null

  var start = Math.floor((page - 1) / 5) * 5 + 1
  var end = Math.min(start + 4, totalPages)
  var pages = []
  for (var i = start; i <= end; i++) {
    pages.push(i)
  }

  return (
    <Flex justify="center" align="center" gap="6px" mt="16px">
      <Button h="28px" px="10px" fontSize="12px" rounded="6px"
        isDisabled={page <= 1}
        onClick={function() { onPageChange(page - 1) }}
        variant="outline" borderColor="#d1d5db">
        ‹
      </Button>
      {start > 1 && (
        <Button h="28px" px="10px" fontSize="12px" rounded="6px"
          variant="outline" borderColor="#d1d5db"
          onClick={function() { onPageChange(start - 1) }}>
          ...
        </Button>
      )}
      {pages.map(function(p) {
        return (
          <Button key={p} h="28px" px="12px" fontSize="12px" rounded="6px"
            bg={p === page ? '#22c55e' : 'transparent'}
            color={p === page ? 'white' : '#666'}
            variant={p === page ? 'solid' : 'outline'}
            borderColor={p === page ? '#22c55e' : '#d1d5db'}
            _hover={p === page ? { bg: '#16a34a' } : { bg: '#f9fafb' }}
            onClick={function() { onPageChange(p) }}>
            {p}
          </Button>
        )
      })}
      {end < totalPages && (
        <Button h="28px" px="10px" fontSize="12px" rounded="6px"
          variant="outline" borderColor="#d1d5db"
          onClick={function() { onPageChange(end + 1) }}>
          ...
        </Button>
      )}
      <Button h="28px" px="10px" fontSize="12px" rounded="6px"
        isDisabled={page >= totalPages}
        onClick={function() { onPageChange(page + 1) }}
        variant="outline" borderColor="#d1d5db">
        ›
      </Button>
    </Flex>
  )
}

const ProjectBranches = () => {
  const { owner, repo } = useParams()
  const [branches, setBranches] = useState([])
  const [stagedFiles, setStagedFiles] = useState([])
  const [workingFiles, setWorkingFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    reposAPI.branches(owner, repo).then(function(data) {
      setBranches(Array.isArray(data && data.branches ? data.branches : data) ? (data.branches || data) : [])
      if (data && data.staged_files) setStagedFiles(data.staged_files)
      if (data && data.working_files) setWorkingFiles(data.working_files)
    }).catch(function() { setBranches([]) }).finally(function() { setLoading(false) })
  }, [owner, repo])

  var totalPages = Math.ceil(branches.length / PAGE_SIZE) || 1
  var startIdx = (page - 1) * PAGE_SIZE
  var endIdx = Math.min(startIdx + PAGE_SIZE, branches.length)
  var pageBranches = branches.slice(startIdx, endIdx)

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="60px">
        <Spinner size="lg" color="#22c55e" />
      </Box>
    )
  }

  return (
    <Box>
      <Text fontSize="14px" fontWeight="600" color="#333" mb="16px">
        🌿 分支 <Text as="span" color="#888" fontWeight="400">({branches.length})</Text>
      </Text>

      <VStack spacing="0" align="stretch" border="1px solid" borderColor="#e2e2e2" rounded="10px" overflow="hidden">
        {pageBranches.map(function(branch, idx) {
          var name = typeof branch === 'string' ? branch : (branch.name || '')
          var isDefault = name === 'main' || name === 'master'
          return (
            <Flex
              key={name || idx}
              align="center" justify="space-between"
              px="16px" py="10px"
              borderBottom={idx < pageBranches.length - 1 ? '1px solid' : 'none'}
              borderColor="#f0f0f0"
              _hover={{ bg: '#f9fafb' }}
              transition="background-color 0.15s"
            >
              <HStack gap="10px">
                <Text fontSize="14px">🌿</Text>
                <Text fontSize="13.5px" fontWeight="500" color="#16a34a" fontFamily="monospace">
                  {name}
                </Text>
                {isDefault && (
                  <Badge fontSize="11px" px="7px" py="1px" rounded="4px" bg="#dcfce7" color="#16a34a">
                    默认
                  </Badge>
                )}
              </HStack>
            </Flex>
          )
        })}
      </VStack>

      <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />

      {stagedFiles.length > 0 && (
        <Box mt="20px">
          <Text fontSize="13px" fontWeight="600" color="#333" mb="8px">已暂存文件 ({stagedFiles.length})</Text>
          <VStack spacing="0" align="stretch" border="1px solid" borderColor="#e2e2e2" rounded="8px" overflow="hidden">
            {stagedFiles.map(function(f, idx) {
              return (
                <Text key={idx} px="12px" py="6px" fontSize="12.5px" fontFamily="monospace" color="#16a34a"
                  borderBottom={idx < stagedFiles.length - 1 ? '1px solid' : 'none'} borderColor="#f0f0f0">
                  {typeof f === 'string' ? f : f.path || f.name}
                </Text>
              )
            })}
          </VStack>
        </Box>
      )}

      {workingFiles.length > 0 && (
        <Box mt="16px">
          <Text fontSize="13px" fontWeight="600" color="#333" mb="8px">已修改文件 ({workingFiles.length})</Text>
          <VStack spacing="0" align="stretch" border="1px solid" borderColor="#e2e2e2" rounded="8px" overflow="hidden">
            {workingFiles.map(function(f, idx) {
              return (
                <Text key={idx} px="12px" py="6px" fontSize="12.5px" fontFamily="monospace" color="#f59e0b"
                  borderBottom={idx < workingFiles.length - 1 ? '1px solid' : 'none'} borderColor="#f0f0f0">
                  {typeof f === 'string' ? f : f.path || f.name}
                </Text>
              )
            })}
          </VStack>
        </Box>
      )}

      {!loading && branches.length === 0 && (
        <Box textAlign="center" py="50px" color="#aaa">
          <Text fontSize="36px" mb="6px">🌿</Text>
          <Text fontSize="14px">暂无分支</Text>
        </Box>
      )}
    </Box>
  )
}

export default ProjectBranches
