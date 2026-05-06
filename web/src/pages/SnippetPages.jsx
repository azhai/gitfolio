import React, { useState, useEffect } from 'react'
import { Box, Text, Flex, HStack, Badge, Button, Spinner, Textarea, Input, Select, useToast } from '@chakra-ui/react'
import { useParams, useNavigate } from 'react-router-dom'
import { snippetsAPI } from '../api/index'
import { timeAgo } from '../i18n/zh'
import { highlightLine } from './project/FileViewer'

var LANG_COLORS = {
  Go: '#00ADD8', JavaScript: '#F7DF1E', TypeScript: '#3178C6',
  Python: '#3572A5', Ruby: '#701516', Java: '#b07219',
  Rust: '#dea584', PHP: '#4F5D95', 'C++': '#f34b7d',
  C: '#555555', Shell: '#89e051', HTML: '#e34c26',
  CSS: '#563d7c', SQL: '#4479A1', Markdown: '#083FA1',
  YAML: '#CB171E', JSON: '#292929', Dockerfile: '#384d54',
}

const LANGUAGES = ['Go', 'JavaScript', 'TypeScript', 'Python', 'Ruby', 'Java', 'Rust', 'PHP', 'C', 'C++', 'Shell', 'HTML', 'CSS', 'SQL', 'YAML', 'JSON', 'Markdown', 'Bash', 'Lua', 'Plain Text']

const SnippetDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [snippet, setSnippet] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    snippetsAPI.get(id).then(function(data) {
      setSnippet(data)
    }).catch(function() { setSnippet(null) }).finally(function() { setLoading(false) })
  }, [id])

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="80px">
        <Spinner size="xl" color="#22c55e" />
      </Box>
    )
  }

  if (!snippet) {
    return (
      <Box textAlign="center" py="60px" color="#aaa">
        <Text fontSize="40px" mb="8px">📝</Text>
        <Text fontSize="15px">未找到该代码片段</Text>
      </Box>
    )
  }

  var lang = snippet.language || ''
  var version = snippet.version || 1
  var code = snippet.code || ''

  return (
    <Box>
      <Flex justify="space-between" align="start" mb="16px">
        <Box flex={1}>
          <HStack gap="10px" mb="6px" flexWrap="wrap">
            <Text fontSize="20px" fontWeight="700" color="#333">{snippet.title}</Text>
            {lang && (
              <HStack gap="5px">
                <Box w="10px" h="10px" rounded="full" bg={LANG_COLORS[lang] || '#888'} />
                <Text fontSize="13px" color="#888">{lang}</Text>
              </HStack>
            )}
            {snippet.visibility && (
              <Badge fontSize="10px" px="6px" py="1px" rounded="4px"
                bg={snippet.visibility === 'public' ? '#dcfce7' : '#fef2f2'}
                color={snippet.visibility === 'public' ? '#16a34a' : '#dc2626'}>
                {snippet.visibility === 'public' ? '公开' : '私有'}
              </Badge>
            )}
          </HStack>
          {snippet.description && <Text fontSize="14px" color="#666" mb="8px">{snippet.description}</Text>}
          <HStack gap="14px" fontSize="12px" color="#aaa">
            {snippet.username && <Text>@{snippet.username}</Text>}
            <Text>第{version}次修改</Text>
            <Text>更新于 {timeAgo(snippet.updated_at)}</Text>
          </HStack>
        </Box>
        <HStack gap="8px">
          <Button h="30px" px="14px" fontSize="13px" rounded="6px" variant="outline"
            borderColor="#d1d5db" color="#666" onClick={function() { navigate('/snippets/' + id + '/edit') }}>
            编辑
          </Button>
          <Button h="30px" px="14px" fontSize="13px" rounded="6px" variant="outline"
            borderColor="#fecaca" color="#dc2626" _hover={{ bg: '#fef2f2' }}
            onClick={function() {
              if (!window.confirm('确定要删除此代码片段吗？')) return
              snippetsAPI.del(id).then(function() { navigate('/snippets') })
            }}>
            删除
          </Button>
        </HStack>
      </Flex>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" overflow="hidden">
        <Flex px="16px" py="10px" borderBottom="1px solid" borderColor="#f0f0f0" justify="space-between" align="center">
          <Text fontSize="13px" fontWeight="600" color="#555">{snippet.filename || 'snippet'}</Text>
          <Button h="24px" px="8px" fontSize="11px" rounded="4px" variant="outline" borderColor="#d1d5db"
            onClick={function() { navigator.clipboard.writeText(code) }}>
            复制
          </Button>
        </Flex>
        <Box overflow="auto" maxH="60vh">
          <Box as="pre" fontSize="13px" fontFamily="'JetBrains Mono', 'Fira Code', Consolas, monospace" lineHeight="1.6" m={0} p={0}>
            {code.split('\n').map(function(line, idx) {
              return (
                <Flex key={idx} _hover={{ bg: '#f0fdf4' }} transition="background-color 0.1s" align="flex-start">
                  <Box w="44px" textAlign="right" pr="12px" pl="12px" color="#bbb" userSelect="none" flexShrink={0} fontSize="12px" lineHeight="1.6" py="0" pos="sticky" left="0" bg="white" zIndex={1}>
                    {idx + 1}
                  </Box>
                  <Box flex={1} pr="16px" py="0" whiteSpace="pre-wrap" wordBreak="break-all" overflowWrap="break-word">
                    <span dangerouslySetInnerHTML={{ __html: highlightLine(line, lang) || ' ' }} />
                  </Box>
                </Flex>
              )
            })}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

const NewSnippet = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    filename: '',
    language: 'Plain Text',
    code: '',
    visibility: 'public',
  })

  function handleSubmit() {
    if (!form.title.trim()) {
      toast({ title: '请输入标题', status: 'error', duration: 3000 })
      return
    }
    setSubmitting(true)
    snippetsAPI.create(form).then(function(data) {
      navigate('/snippets/' + data.id)
    }).catch(function(err) {
      toast({ title: err.message || '创建失败', status: 'error', duration: 3000 })
    }).finally(function() { setSubmitting(false) })
  }

  return (
    <Box maxW="800px" mx="auto">
      <Text fontSize="22px" fontWeight="700" color="#333" mb="24px">新建代码片段</Text>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="28px">
        <Box mb="16px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">标题 *</Text>
          <Input value={form.title} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { title: e.target.value }) }) }}
            placeholder="代码片段标题" h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="16px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">描述</Text>
          <Input value={form.description} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { description: e.target.value }) }) }}
            placeholder="简短描述" h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Flex gap="16px" mb="16px">
          <Box flex={1}>
            <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">文件名</Text>
            <Input value={form.filename} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { filename: e.target.value }) }) }}
              placeholder="example.go" h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
              _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
          </Box>
          <Box w="180px">
            <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">语言</Text>
            <Select value={form.language} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { language: e.target.value }) }) }}
              h="40px" fontSize="14px" borderColor="#d1d5db" borderRadius="8px">
              {LANGUAGES.map(function(l) { return <option key={l} value={l}>{l}</option> })}
            </Select>
          </Box>
        </Flex>

        <Box mb="16px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">可见性</Text>
          <Flex gap="12px">
            <Button h="32px" px="14px" fontSize="13px" rounded="6px"
              bg={form.visibility === 'public' ? '#22c55e' : '#f3f4f6'} color={form.visibility === 'public' ? 'white' : '#666'}
              _hover={{ bg: form.visibility === 'public' ? '#16a34a' : '#e5e7eb' }}
              onClick={function() { setForm(function(p) { return Object.assign({}, p, { visibility: 'public' }) }) }}>
              🌐 公开
            </Button>
            <Button h="32px" px="14px" fontSize="13px" rounded="6px"
              bg={form.visibility === 'private' ? '#22c55e' : '#f3f4f6'} color={form.visibility === 'private' ? 'white' : '#666'}
              _hover={{ bg: form.visibility === 'private' ? '#16a34a' : '#e5e7eb' }}
              onClick={function() { setForm(function(p) { return Object.assign({}, p, { visibility: 'private' }) }) }}>
              🔒 私有
            </Button>
          </Flex>
        </Box>

        <Box mb="24px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">代码内容 *</Text>
          <Textarea value={form.code} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { code: e.target.value }) }) }}
            placeholder="在此输入代码..." fontSize="13px" fontFamily="'JetBrains Mono', 'Fira Code', Consolas, monospace"
            borderRadius="8px" borderColor="#d1d5db" rows={15}
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Flex justify="flex-end" gap="10px">
          <Button h="36px" px="16px" fontSize="13px" rounded="6px" variant="outline"
            borderColor="#d1d5db" color="#666" onClick={function() { navigate(-1) }}>
            取消
          </Button>
          <Button h="36px" px="24px" fontSize="14px" rounded="6px" bg="#22c55e" color="white"
            _hover={{ bg: '#16a34a' }} onClick={handleSubmit} isLoading={submitting}>
            创建片段
          </Button>
        </Flex>
      </Box>
    </Box>
  )
}

const EditSnippet = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    filename: '',
    language: 'Plain Text',
    code: '',
    visibility: 'public',
  })

  useEffect(() => {
    snippetsAPI.get(id).then(function(data) {
      setForm({
        title: data.title || '',
        description: data.description || '',
        filename: data.filename || '',
        language: data.language || 'Plain Text',
        code: data.code || '',
        visibility: data.visibility || 'public',
      })
    }).catch(function() {}).finally(function() { setLoading(false) })
  }, [id])

  function handleSubmit() {
    setSubmitting(true)
    snippetsAPI.update(id, form).then(function(data) {
      navigate('/snippets/' + id)
    }).catch(function(err) {
      toast({ title: err.message || '更新失败', status: 'error', duration: 3000 })
    }).finally(function() { setSubmitting(false) })
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="80px">
        <Spinner size="xl" color="#22c55e" />
      </Box>
    )
  }

  return (
    <Box maxW="800px" mx="auto">
      <Text fontSize="22px" fontWeight="700" color="#333" mb="24px">编辑代码片段</Text>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="28px">
        <Box mb="16px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">标题 *</Text>
          <Input value={form.title} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { title: e.target.value }) }) }}
            h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="16px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">描述</Text>
          <Input value={form.description} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { description: e.target.value }) }) }}
            h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Flex gap="16px" mb="16px">
          <Box flex={1}>
            <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">文件名</Text>
            <Input value={form.filename} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { filename: e.target.value }) }) }}
              h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
              _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
          </Box>
          <Box w="180px">
            <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">语言</Text>
            <Select value={form.language} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { language: e.target.value }) }) }}
              h="40px" fontSize="14px" borderColor="#d1d5db" borderRadius="8px">
              {LANGUAGES.map(function(l) { return <option key={l} value={l}>{l}</option> })}
            </Select>
          </Box>
        </Flex>

        <Box mb="24px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">代码内容 *</Text>
          <Textarea value={form.code} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { code: e.target.value }) }) }}
            fontSize="13px" fontFamily="'JetBrains Mono', 'Fira Code', Consolas, monospace"
            borderRadius="8px" borderColor="#d1d5db" rows={15}
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Flex justify="flex-end" gap="10px">
          <Button h="36px" px="16px" fontSize="13px" rounded="6px" variant="outline"
            borderColor="#d1d5db" color="#666" onClick={function() { navigate(-1) }}>
            取消
          </Button>
          <Button h="36px" px="24px" fontSize="14px" rounded="6px" bg="#22c55e" color="white"
            _hover={{ bg: '#16a34a' }} onClick={handleSubmit} isLoading={submitting}>
            保存更改
          </Button>
        </Flex>
      </Box>
    </Box>
  )
}

export { SnippetDetail, NewSnippet, EditSnippet }
