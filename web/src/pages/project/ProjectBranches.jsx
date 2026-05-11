import React, { useState, useEffect } from 'react'
import { Box, Text, Flex, VStack, HStack, Badge, Spinner, Button } from '@chakra-ui/react'
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom'
import { reposAPI } from '../../api/index'
import { t, timeAgo } from '../../i18n/index'
import { LuGitBranch as GitBranch, LuUpload as UploadIcon, LuPlus as PlusIcon, LuPencil as EditIcon } from 'react-icons/lu'

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

function LocalStatusSection(_ref) {
  var unpushedCommits = _ref.unpushedCommits
  var stagedFiles = _ref.stagedFiles
  var workingFiles = _ref.workingFiles
  var untrackedFiles = _ref.untrackedFiles

  var hasUnpushed = unpushedCommits && unpushedCommits.length > 0
  var hasStaged = stagedFiles && stagedFiles.length > 0
  var hasWorking = workingFiles && workingFiles.length > 0
  var hasUntracked = untrackedFiles && untrackedFiles.length > 0
  var hasLocalChanges = hasStaged || hasWorking || hasUntracked

  if (!hasUnpushed && !hasLocalChanges) return null

  return (
    <Box mt="20px">
      <Text fontSize="14px" fontWeight="600" color="#333" mb="12px">{t('projectBranches.localStatus')}</Text>

      {hasUnpushed && (
        <Box mb="16px" border="1px solid" borderColor="#e2e2e2" rounded="10px" overflow="hidden">
          <Flex align="center" px="14px" py="10px" bg="#faf5ff" borderBottom="1px solid" borderColor="#e2e2e2">
            <UploadIcon size={14} color="#7c3aed" />
            <Text fontSize="13px" fontWeight="600" color="#7c3aed" ml="8px">
              {t('projectBranches.unpushedCommits')} ({unpushedCommits.length})
            </Text>
          </Flex>
          <VStack spacing="0" align="stretch">
            {unpushedCommits.map(function(commit, idx) {
              return (
                <Flex key={commit.hash || idx} align="center" px="14px" py="8px"
                  borderBottom={idx < unpushedCommits.length - 1 ? '1px solid' : 'none'} borderColor="#f0f0f0"
                  _hover={{ bg: '#f9fafb' }}>
                  <Badge fontSize="11px" px="6px" py="1px" rounded="4px" bg="#f0fdf4" color="#16a34a"
                    fontFamily="monospace" mr="10px">
                    {commit.short_hash}
                  </Badge>
                  <Text fontSize="13px" color="#333" flex={1} noOfLines={1}>{commit.message}</Text>
                  <Text fontSize="12px" color="#888" ml="10px">{commit.author}</Text>
                  <Text fontSize="11px" color="#aaa" ml="8px">{timeAgo(commit.date)}</Text>
                </Flex>
              )
            })}
          </VStack>
        </Box>
      )}

      {hasStaged && (
        <Box mb="16px" border="1px solid" borderColor="#e2e2e2" rounded="10px" overflow="hidden">
          <Flex align="center" px="14px" py="10px" bg="#f0fdf4" borderBottom="1px solid" borderColor="#e2e2e2">
            <PlusIcon size={14} color="#16a34a" />
            <Text fontSize="13px" fontWeight="600" color="#16a34a" ml="8px">
              {t('projectBranches.stagedFiles')} ({stagedFiles.length})
            </Text>
          </Flex>
          <VStack spacing="0" align="stretch">
            {stagedFiles.map(function(f, idx) {
              return (
                <Flex key={idx} align="center" px="14px" py="7px"
                  borderBottom={idx < stagedFiles.length - 1 ? '1px solid' : 'none'} borderColor="#f0f0f0"
                  _hover={{ bg: '#f9fafb' }}>
                  <Text fontSize="12.5px" fontFamily="monospace" color="#16a34a">
                    {typeof f === 'string' ? f : f.path || f.name}
                  </Text>
                </Flex>
              )
            })}
          </VStack>
        </Box>
      )}

      {hasWorking && (
        <Box mb="16px" border="1px solid" borderColor="#e2e2e2" rounded="10px" overflow="hidden">
          <Flex align="center" px="14px" py="10px" bg="#fffbeb" borderBottom="1px solid" borderColor="#e2e2e2">
            <EditIcon size={14} color="#d97706" />
            <Text fontSize="13px" fontWeight="600" color="#d97706" ml="8px">
              {t('projectBranches.modifiedFiles')} ({workingFiles.length})
            </Text>
          </Flex>
          <VStack spacing="0" align="stretch">
            {workingFiles.map(function(f, idx) {
              return (
                <Flex key={idx} align="center" px="14px" py="7px"
                  borderBottom={idx < workingFiles.length - 1 ? '1px solid' : 'none'} borderColor="#f0f0f0"
                  _hover={{ bg: '#f9fafb' }}>
                  <Text fontSize="12.5px" fontFamily="monospace" color="#d97706">
                    {typeof f === 'string' ? f : f.path || f.name}
                  </Text>
                </Flex>
              )
            })}
          </VStack>
        </Box>
      )}

      {hasUntracked && (
        <Box mb="16px" border="1px solid" borderColor="#e2e2e2" rounded="10px" overflow="hidden">
          <Flex align="center" px="14px" py="10px" bg="#f9fafb" borderBottom="1px solid" borderColor="#e2e2e2">
            <PlusIcon size={14} color="#6b7280" />
            <Text fontSize="13px" fontWeight="600" color="#6b7280" ml="8px">
              {t('projectBranches.untrackedFiles')} ({untrackedFiles.length})
            </Text>
          </Flex>
          <VStack spacing="0" align="stretch">
            {untrackedFiles.map(function(f, idx) {
              return (
                <Flex key={idx} align="center" px="14px" py="7px"
                  borderBottom={idx < untrackedFiles.length - 1 ? '1px solid' : 'none'} borderColor="#f0f0f0"
                  _hover={{ bg: '#f9fafb' }}>
                  <Text fontSize="12.5px" fontFamily="monospace" color="#6b7280">
                    {typeof f === 'string' ? f : f.path || f.name}
                  </Text>
                </Flex>
              )
            })}
          </VStack>
        </Box>
      )}
    </Box>
  )
}

const ProjectBranches = () => {
  const { owner, repo } = useParams()
  const navigate = useNavigate()
  const [branches, setBranches] = useState([])
  const [stagedFiles, setStagedFiles] = useState([])
  const [workingFiles, setWorkingFiles] = useState([])
  const [untrackedFiles, setUntrackedFiles] = useState([])
  const [unpushedCommits, setUnpushedCommits] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    reposAPI.branches(owner, repo).then(function(data) {
      setBranches(Array.isArray(data && data.branches ? data.branches : data) ? (data.branches || data) : [])
      if (data && data.staged_files) setStagedFiles(data.staged_files)
      if (data && data.working_files) setWorkingFiles(data.working_files)
      if (data && data.untracked_files) setUntrackedFiles(data.untracked_files)
      if (data && data.unpushed_commits) setUnpushedCommits(data.unpushed_commits)
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
      <HStack gap="8px" fontSize="14px" fontWeight="600" color="#333" mb="16px">
        <GitBranch size={16} color="#333" />
        <Text>{t('branch.title')}</Text>
        <Text as="span" color="#888" fontWeight="400">({branches.length})</Text>
      </HStack>

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
                <GitBranch size={14} color="#16a34a" />
                <RouterLink to={'/' + owner + '/' + repo + '/tree/' + name}
                  style={{ textDecoration: 'none' }}>
                  <Text fontSize="13.5px" fontWeight="500" color="#16a34a" fontFamily="monospace"
                    _hover={{ textDecoration: 'underline' }}>
                    {name}
                  </Text>
                </RouterLink>
                {isDefault && (
                  <Badge fontSize="11px" px="7px" py="1px" rounded="4px" bg="#dcfce7" color="#16a34a">
                    {t('projectBranches.default')}
                  </Badge>
                )}
              </HStack>
            </Flex>
          )
        })}
      </VStack>

      <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />

      <LocalStatusSection
        unpushedCommits={unpushedCommits}
        stagedFiles={stagedFiles}
        workingFiles={workingFiles}
        untrackedFiles={untrackedFiles}
      />

      {!loading && branches.length === 0 && (
        <Box textAlign="center" py="50px" color="#aaa">
          <GitBranch size={36} color="#ccc" mb="6px" />
          <Text fontSize="14px">{t('projectBranches.noBranches')}</Text>
        </Box>
      )}
    </Box>
  )
}

export default ProjectBranches
