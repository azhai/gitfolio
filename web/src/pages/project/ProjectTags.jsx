import React, { useState, useEffect } from 'react'
import { Box, Text, Flex, VStack, HStack, Spinner } from '@chakra-ui/react'
import { useParams, Link as RouterLink } from 'react-router-dom'
import { reposAPI } from '../../api/index'
import { t } from '../../i18n/index'

const ProjectTags = () => {
  const { owner, repo } = useParams()
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    reposAPI.tags(owner, repo).then(function(data) {
      setTags(Array.isArray(data && data.tags ? data.tags : data) ? (data.tags || data) : [])
    }).catch(function() { setTags([]) }).finally(function() { setLoading(false) })
  }, [owner, repo])

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
        🏷️ {t('tag.title')} <Text as="span" color="#888" fontWeight="400">({tags.length})</Text>
      </Text>

      <Box display="grid" gridTemplateColumns="repeat(5, 1fr)" gap="8px">
        {tags.map(function(tag, idx) {
          var name = typeof tag === 'string' ? tag : (tag.name || tag.tag || '')
          return (
            <RouterLink key={name || idx} to={'/' + owner + '/' + repo + '/tree/' + name}
              style={{ textDecoration: 'none' }}>
              <Flex align="center" gap="6px" px="10px" py="8px" bg="#f5f3ff" rounded="6px"
                _hover={{ bg: '#ede9fe' }} transition="background-color 0.15s">
                <Text fontSize="13px">🏷️</Text>
                <Text fontSize="13px" fontWeight="500" color="#7c3aed" fontFamily="monospace"
                  overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                  {name}
                </Text>
              </Flex>
            </RouterLink>
          )
        })}
      </Box>

      {!loading && tags.length === 0 && (
        <Box textAlign="center" py="50px" color="#aaa">
          <Text fontSize="36px" mb="6px">🏷️</Text>
          <Text fontSize="14px">{t('projectTags.noTags')}</Text>
        </Box>
      )}
    </Box>
  )
}

export default ProjectTags
