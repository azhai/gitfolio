import React, { useState, useEffect } from 'react'
import { Box, Text, Input, Flex, HStack, Badge, Button, Spinner, SimpleGrid } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { snippetsAPI } from '../api/index'
import { timeAgo } from '../i18n/zh'

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
        <Text fontSize="22px" fontWeight="700" color="#333">📝 代码片段</Text>
        <Button h="32px" px="16px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
          _hover={{ bg: '#16a34a' }} onClick={function() { navigate('/snippets/new') }}>
          + 新建片段
        </Button>
      </Flex>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px" mb="24px">
        <Input placeholder="搜索代码片段..." value={search} onChange={function(e) { setSearch(e.target.value) }}
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
                      {s.visibility === 'public' ? '公开' : '私有'}
                    </Badge>
                  )}
                </HStack>
                <Text fontSize="13px" color="#666" mb="10px" noOfLines={2}>{s.description || '暂无描述'}</Text>
                <HStack gap="14px" fontSize="12px" color="#aaa">
                  {s.username && <Text>@{s.username}</Text>}
                  {version > 1 && <Text>第{version}次修改</Text>}
                  <Text>更新于 {timeAgo(s.updated_at)}</Text>
                </HStack>
              </Box>
            </Box>
          )
        })}
      </SimpleGrid>

      {!loading && filtered.length === 0 && (
        <Box textAlign="center" py="60px" color="#aaa">
          <Text fontSize="40px" mb="8px">📝</Text>
          <Text fontSize="15px">未找到代码片段</Text>
        </Box>
      )}
    </Box>
  )
}

export default Snippets
