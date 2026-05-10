import React, { useState, useEffect } from 'react'
import { Box, Text, Input, Flex, HStack, Badge, Button, Spinner, SimpleGrid } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { snippetsAPI } from '../api/index'
import { timeAgo, t } from '../i18n'
import { LuFileCode as FileCode } from 'react-icons/lu'
import { useAuth } from '../contexts/AuthContext'

var LANG_COLORS = {
  Go: '#00ADD8', JavaScript: '#F7DF1E', TypeScript: '#3178C6',
  Python: '#3572A5', Ruby: '#701516', Java: '#b07219',
  Rust: '#dea584', PHP: '#4F5D95', 'C++': '#f34b7d',
  C: '#555555', Shell: '#89e051', HTML: '#e34c26',
  CSS: '#563d7c', SQL: '#4479A1', Markdown: '#083FA1',
  YAML: '#CB171E', JSON: '#292929', Dockerfile: '#384d54',
}

const Snippets = () => {
  const [snippets, setSnippets] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { isGuest } = useAuth()

  useEffect(() => {
    snippetsAPI.list().then(function(data) {
      setSnippets(Array.isArray(data) ? data : [])
    }).catch(function() { setSnippets([]) }).finally(function() { setLoading(false) })
  }, [])

  var filtered = snippets.filter(function(s) {
    var q = search.toLowerCase()
    return ((s.title || '') + ' ' + (s.description || '')).toLowerCase().indexOf(q) >= 0
  })

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="80px">
        <Spinner size="xl" color="#22c55e" />
      </Box>
    )
  }

  return (
    <Box>
      <Flex justify="space-between" align="center" mb="20px">
        <HStack gap="8px">
          <FileCode size={22} color="#16a34a" />
          <Text fontSize="22px" fontWeight="700" color="#333">{t('snippets.title')}</Text>
        </HStack>
        <Button h="32px" px="16px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
          _hover={{ bg: '#16a34a' }} onClick={function() { navigate('/snippets/new') }} isDisabled={isGuest}>
          {t('snippets.newSnippet')}
        </Button>
      </Flex>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px" mb="24px">
        <Input placeholder={t('snippets.searchPlaceholder')} value={search} onChange={function(e) { setSearch(e.target.value) }}
          h="36px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
          _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
      </Box>

      <SimpleGrid columns={2} spacing="14px">
        {filtered.map(function(s) {
          var lang = s.language || ''
          var version = s.version || 1
          return (
            <Box key={s.id}
              bg="white" border="1px solid" borderColor="#e2e2e2"
              rounded="10px" cursor="pointer" transition="all 0.15s"
              _hover={{ borderColor: '#22c55e', boxShadow: '0 2px 8px rgba(34,197,94,0.08)' }}
              onClick={function() { navigate('/snippets/' + s.id) }}>
              <Box p="18px">
                <HStack gap="10px" mb="6px" flexWrap="wrap">
                  <Text fontSize="15px" fontWeight="600" color="#333">{s.title}</Text>
                  {lang && (
                    <HStack gap="5px">
                      <Box w="10px" h="10px" rounded="full" bg={LANG_COLORS[lang] || '#888'} />
                      <Text fontSize="12px" color="#888">{lang}</Text>
                    </HStack>
                  )}
                  {s.visibility && (
                    <Badge fontSize="10px" px="6px" py="1px" rounded="4px"
                      bg={s.visibility === 'public' ? '#dcfce7' : '#fef2f2'}
                      color={s.visibility === 'public' ? '#16a34a' : '#dc2626'}>
                      {s.visibility === 'public' ? t('common.public') : t('common.private')}
                    </Badge>
                  )}
                </HStack>
                <Text fontSize="13px" color="#666" mb="10px" noOfLines={2}>{s.description || t('dashboard.noDescription')}</Text>
                <HStack gap="14px" fontSize="12px" color="#aaa">
                  {s.username && <Text>@{s.username}</Text>}
                  {version > 1 && <Text>{t('snippets.versionN', { n: version })}</Text>}
                  <Text>{t('snippets.updatedAt')} {timeAgo(s.updated_at)}</Text>
                </HStack>
              </Box>
            </Box>
          )
        })}
      </SimpleGrid>

      {!loading && filtered.length === 0 && (
        <Box textAlign="center" py="60px" color="#aaa">
          <FileCode size={40} color="#ccc" mb="8px" />
          <Text fontSize="15px">{t('snippets.notFound')}</Text>
        </Box>
      )}
    </Box>
  )
}

export default Snippets
