import React, { useState, useEffect } from 'react'
import { Box, Text, Flex, VStack, HStack, Badge, Button, Spinner } from '@chakra-ui/react'
import { useParams } from 'react-router-dom'
import { releasesAPI } from '../../api/index'
import { t, timeAgo } from '../../i18n/index'
import { LuRocket as Rocket, LuUser as User } from 'react-icons/lu'

const ProjectReleases = () => {
  const { owner, repo } = useParams()
  const [releases, setReleases] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    releasesAPI.list(owner, repo).then(function(res) {
      setReleases(Array.isArray(res.data) ? res.data : [])
    }).catch(function() { setReleases([]) }).finally(function() { setLoading(false) })
  }, [owner, repo])

  function handleSync() {
    setSyncing(true)
    releasesAPI.sync(owner, repo).then(function() {
      return releasesAPI.list(owner, repo)
    }).then(function(res) {
      setReleases(Array.isArray(res.data) ? res.data : [])
    }).catch(function() {}).finally(function() { setSyncing(false) })
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="60px">
        <Spinner size="lg" color="#22c55e" />
      </Box>
    )
  }

  return (
    <Box>
      <Flex justify="space-between" align="center" mb="16px">
        <HStack gap="8px" fontSize="14px" fontWeight="600" color="#333">
          <Rocket size={16} color="#333" />
          <Text>{t('release.title')}</Text>
          <Text as="span" color="#888" fontWeight="400">({releases.length})</Text>
        </HStack>
        <Button h="30px" px="14px" fontSize="13px" rounded="6px" variant="outline"
          borderColor="#d1d5db" color="#666"
          _hover={{ borderColor: '#22c55e', color: '#16a34a' }}
          onClick={handleSync} isLoading={syncing}>
          {t('projectReleases.syncFromRemote')}
        </Button>
      </Flex>

      <VStack spacing="14px" align="stretch">
        {releases.map(function(r) {
          return (
            <Box key={r.id || r.tag_name} bg="white" border="1px solid" borderColor="#e2e2e2"
              rounded="10px" p="20px" transition="all 0.15s"
              _hover={{ borderColor: '#d1d5db', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <Flex justify="space-between" align="start">
                <Box flex={1}>
                  <HStack gap="8px" mb="6px" align="center">
                    <Text fontSize="15px" fontWeight="600" color="#333">
                      {r.title || r.tag_name}
                    </Text>
                    <Badge fontSize="11px" px="7px" py="1px" rounded="4px"
                      bg="#ede9fe" color="#7c3aed" fontFamily="monospace">
                      {r.tag_name}
                    </Badge>
                    {r.is_draft && (
                      <Badge fontSize="11px" px="7px" py="1px" rounded="4px" bg="#fef2f2" color="#dc2626">
                        {t('projectReleases.draft')}
                      </Badge>
                    )}
                    {r.is_prerelease && (
                      <Badge fontSize="11px" px="7px" py="1px" rounded="4px" bg="#fffbeb" color="#f59e0b">
                        {t('projectReleases.prerelease')}
                      </Badge>
                    )}
                  </HStack>
                  {r.body && (
                    <Text fontSize="13px" color="#666" mb="10px" noOfLines={3} whiteSpace="pre-wrap">
                      {r.body}
                    </Text>
                  )}
                  <HStack gap="14px" fontSize="12.5px" color="#888">
                    {r.author && <HStack gap="4px"><User size={13} /><Text>{r.author.username || r.author.full_name || t('common.unknownUser')}</Text></HStack>}
                    <Text>{timeAgo(r.created_at)}</Text>
                  </HStack>
                </Box>
              </Flex>
            </Box>
          )
        })}
      </VStack>

      {!loading && releases.length === 0 && (
        <Box textAlign="center" py="50px" color="#aaa">
          <Rocket size={36} color="#ccc" mb="6px" />
          <Text fontSize="14px">{t('projectReleases.noReleases')}</Text>
        </Box>
      )}
    </Box>
  )
}

export default ProjectReleases
