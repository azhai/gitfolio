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

      <VStack spacing="0" align="stretch" border="1px solid" borderColor="#e2e2e2" rounded="10px" overflow="hidden">
        {tags.map(function(tag, idx) {
          var name = typeof tag === 'string' ? tag : (tag.name || tag.tag || '')
          return (
            <Flex
              key={name || idx}
              align="center" justify="space-between"
              px="16px" py="12px"
              borderBottom={idx < tags.length - 1 ? '1px solid' : 'none'}
              borderColor="#f0f0f0"
              _hover={{ bg: '#f9fafb' }}
              transition="background-color 0.15s"
            >
              <HStack gap="10px">
                <Text fontSize="14px">🏷️</Text>
                <RouterLink to={'/' + owner + '/' + repo + '/tree/' + name}
                  style={{ textDecoration: 'none' }}>
                  <Text fontSize="13.5px" fontWeight="500" color="#7c3aed" fontFamily="monospace"
                    _hover={{ textDecoration: 'underline' }}>
                    {name}
                  </Text>
                </RouterLink>
              </HStack>
            </Flex>
          )
        })}
      </VStack>

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
