import React, { useState, useEffect } from 'react'
import { Box, Text, Flex, HStack, Badge, Button, Spinner, Textarea, Input, Select, useToast } from '@chakra-ui/react'
import { useParams, useNavigate } from 'react-router-dom'
import { snippetsAPI } from '../api/index'
import { t, timeAgo } from '../i18n/index'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { getThemeStyle } from '../codeThemes'
import { LuFileCode as FileCode, LuGlobe as Globe, LuLock as Lock } from 'react-icons/lu'

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
          <FileCode size={40} color="#ccc" mb="8px" />
          <Text fontSize="15px">{t('snippet.notFound')}</Text>
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
                {snippet.visibility === 'public' ? t('common.public') : t('common.private')}
              </Badge>
            )}
          </HStack>
          {snippet.description && <Text fontSize="14px" color="#666" mb="8px">{snippet.description}</Text>}
          <HStack gap="14px" fontSize="12px" color="#aaa">
            {snippet.username && <Text>@{snippet.username}</Text>}
            <Text>{t('snippet.revision', { version })}</Text>
            <Text>{t('snippet.updatedAt')} {timeAgo(snippet.updated_at)}</Text>
          </HStack>
        </Box>
        <HStack gap="8px">
          <Button h="30px" px="14px" fontSize="13px" rounded="6px" variant="outline"
            borderColor="#d1d5db" color="#666" onClick={function() { navigate('/snippets/' + id + '/edit') }}>
            {t('snippet.edit')}
          </Button>
          <Button h="30px" px="14px" fontSize="13px" rounded="6px" variant="outline"
            borderColor="#fecaca" color="#dc2626" _hover={{ bg: '#fef2f2' }}
            onClick={function() {
              if (!window.confirm(t('snippet.confirmDelete'))) return
              snippetsAPI.del(id).then(function() { navigate('/snippets') })
            }}>
            {t('snippet.delete')}
          </Button>
        </HStack>
      </Flex>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" overflow="hidden">
        <Flex px="16px" py="10px" borderBottom="1px solid" borderColor="#f0f0f0" justify="space-between" align="center">
          <Text fontSize="13px" fontWeight="600" color="#555">{snippet.filename || 'snippet'}</Text>
          <Button h="24px" px="8px" fontSize="11px" rounded="4px" variant="outline" borderColor="#d1d5db"
            onClick={function() { navigator.clipboard.writeText(code) }}>
            {t('snippet.copy')}
          </Button>
        </Flex>
        <SyntaxHighlighter
          language={(lang || '').toLowerCase()}
          style={getThemeStyle()}
          showLineNumbers={true}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            fontSize: '13px',
            lineHeight: '1.6',
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            maxHeight: '60vh',
            overflow: 'auto',
          }}
          lineNumberStyle={{
            color: '#4b5263',
            minWidth: '44px',
            paddingRight: '12px',
            paddingLeft: '12px',
            fontSize: '12px',
          }}
        >
          {code}
        </SyntaxHighlighter>
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
      toast({ title: t('snippet.titleRequired'), status: 'error', duration: 3000 })
      return
    }
    setSubmitting(true)
    snippetsAPI.create(form).then(function(data) {
      navigate('/snippets/' + data.id)
    }).catch(function(err) {
      toast({ title: err.message || t('snippet.createFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setSubmitting(false) })
  }

  return (
    <Box maxW="800px" mx="auto">
      <Text fontSize="22px" fontWeight="700" color="#333" mb="24px">{t('snippet.newSnippet')}</Text>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="28px">
        <Box mb="16px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('snippet.title')} *</Text>
          <Input value={form.title} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { title: e.target.value }) }) }}
            placeholder={t('snippet.titlePlaceholder')} h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="16px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('snippet.description')}</Text>
          <Input value={form.description} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { description: e.target.value }) }) }}
            placeholder={t('snippet.descriptionPlaceholder')} h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Flex gap="16px" mb="16px">
          <Box flex={1}>
            <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('snippet.filename')}</Text>
            <Input value={form.filename} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { filename: e.target.value }) }) }}
              placeholder="example.go" h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
              _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
          </Box>
          <Box w="180px">
            <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('snippet.language')}</Text>
            <Select value={form.language} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { language: e.target.value }) }) }}
              h="40px" fontSize="14px" borderColor="#d1d5db" borderRadius="8px">
              {LANGUAGES.map(function(l) { return <option key={l} value={l}>{l}</option> })}
            </Select>
          </Box>
        </Flex>

        <Box mb="16px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('snippet.visibility')}</Text>
          <Flex gap="12px">
            <Button h="32px" px="14px" fontSize="13px" rounded="6px"
              bg={form.visibility === 'public' ? '#22c55e' : '#f3f4f6'} color={form.visibility === 'public' ? 'white' : '#666'}
              _hover={{ bg: form.visibility === 'public' ? '#16a34a' : '#e5e7eb' }}
              onClick={function() { setForm(function(p) { return Object.assign({}, p, { visibility: 'public' }) }) }}>
              <HStack gap="6px" justify="center">
                <Globe size={18} />
                <Text>{t('common.public')}</Text>
              </HStack>
            </Button>
            <Button h="32px" px="14px" fontSize="13px" rounded="6px"
              bg={form.visibility === 'private' ? '#22c55e' : '#f3f4f6'} color={form.visibility === 'private' ? 'white' : '#666'}
              _hover={{ bg: form.visibility === 'private' ? '#16a34a' : '#e5e7eb' }}
              onClick={function() { setForm(function(p) { return Object.assign({}, p, { visibility: 'private' }) }) }}>
              <HStack gap="6px" justify="center">
                <Lock size={18} />
                <Text>{t('common.private')}</Text>
              </HStack>
            </Button>
          </Flex>
        </Box>

        <Box mb="24px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('snippet.codeContent')} *</Text>
          <Textarea value={form.code} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { code: e.target.value }) }) }}
            placeholder={t('snippet.codePlaceholder')} fontSize="13px" fontFamily="'JetBrains Mono', 'Fira Code', Consolas, monospace"
            borderRadius="8px" borderColor="#d1d5db" rows={15}
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Flex justify="flex-end" gap="10px">
          <Button h="36px" px="16px" fontSize="13px" rounded="6px" variant="outline"
            borderColor="#d1d5db" color="#666" onClick={function() { navigate(-1) }}>
            {t('common.cancel')}
          </Button>
          <Button h="36px" px="24px" fontSize="14px" rounded="6px" bg="#22c55e" color="white"
            _hover={{ bg: '#16a34a' }} onClick={handleSubmit} isLoading={submitting}>
            {t('snippet.createSnippet')}
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
      toast({ title: err.message || t('snippet.updateFailed'), status: 'error', duration: 3000 })
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
      <Text fontSize="22px" fontWeight="700" color="#333" mb="24px">{t('snippet.editSnippet')}</Text>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="28px">
        <Box mb="16px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('snippet.title')} *</Text>
          <Input value={form.title} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { title: e.target.value }) }) }}
            h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="16px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('snippet.description')}</Text>
          <Input value={form.description} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { description: e.target.value }) }) }}
            h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Flex gap="16px" mb="16px">
          <Box flex={1}>
            <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('snippet.filename')}</Text>
            <Input value={form.filename} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { filename: e.target.value }) }) }}
              h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
              _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
          </Box>
          <Box w="180px">
            <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('snippet.language')}</Text>
            <Select value={form.language} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { language: e.target.value }) }) }}
              h="40px" fontSize="14px" borderColor="#d1d5db" borderRadius="8px">
              {LANGUAGES.map(function(l) { return <option key={l} value={l}>{l}</option> })}
            </Select>
          </Box>
        </Flex>

        <Box mb="24px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('snippet.codeContent')} *</Text>
          <Textarea value={form.code} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { code: e.target.value }) }) }}
            fontSize="13px" fontFamily="'JetBrains Mono', 'Fira Code', Consolas, monospace"
            borderRadius="8px" borderColor="#d1d5db" rows={15}
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Flex justify="flex-end" gap="10px">
          <Button h="36px" px="16px" fontSize="13px" rounded="6px" variant="outline"
            borderColor="#d1d5db" color="#666" onClick={function() { navigate(-1) }}>
            {t('common.cancel')}
          </Button>
          <Button h="36px" px="24px" fontSize="14px" rounded="6px" bg="#22c55e" color="white"
            _hover={{ bg: '#16a34a' }} onClick={handleSubmit} isLoading={submitting}>
            {t('snippet.saveChanges')}
          </Button>
        </Flex>
      </Box>
    </Box>
  )
}

export { SnippetDetail, NewSnippet, EditSnippet }
