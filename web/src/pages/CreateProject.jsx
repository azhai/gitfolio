import React, { useState } from 'react'
import { Box, Text, Input, Textarea, Button, Flex, Switch, useToast, Spinner } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { reposAPI } from '../api/index'

const CreateProject = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    homepage: '',
    is_private: false,
    default_branch: 'main',
    init_readme: true,
  })

  function updateField(key) {
    return function(e) {
      var val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
      setForm(function(prev) { return Object.assign({}, prev, { [key]: val }) })
    }
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast({ title: '请输入项目名称', status: 'error', duration: 3000 })
      return
    }
    setSubmitting(true)
    reposAPI.create(form).then(function(data) {
      navigate('/' + (data.owner || 'ryan') + '/' + data.name)
    }).catch(function(err) {
      toast({ title: err.message || '创建项目失败', status: 'error', duration: 3000 })
    }).finally(function() { setSubmitting(false) })
  }

  return (
    <Box maxW="720px" mx="auto">
      <Text fontSize="22px" fontWeight="700" color="#333" mb="24px">新建项目</Text>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="28px">
        <Box mb="18px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">项目名称 *</Text>
          <Input value={form.name} onChange={updateField('name')}
            placeholder="my-project" h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
          <Text fontSize="12px" color="#999" mt="4px">好的项目名称使用短小、易记且独特的词</Text>
        </Box>

        <Box mb="18px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">描述</Text>
          <Textarea value={form.description} onChange={updateField('description')}
            placeholder="项目描述（可选）" fontSize="14px" borderRadius="8px" borderColor="#d1d5db" rows={3}
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="18px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">主页</Text>
          <Input value={form.homepage} onChange={updateField('homepage')}
            placeholder="https://example.com" h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="18px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">默认分支</Text>
          <Input value={form.default_branch} onChange={updateField('default_branch')}
            placeholder="main" h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="24px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="12px">可见性</Text>
          <Flex gap="16px">
            <Flex
              flex={1} direction="column" align="center" p="16px"
              border="2px solid" borderColor={!form.is_private ? '#22c55e' : '#d1d5db'}
              rounded="10px" cursor="pointer" bg={!form.is_private ? '#f0fdf4' : 'white'}
              onClick={function() { setForm(function(p) { return Object.assign({}, p, { is_private: false }) }) }}
              transition="all 0.15s"
            >
              <Text fontSize="24px" mb="6px">🌐</Text>
              <Text fontSize="14px" fontWeight="600" color={!form.is_private ? '#16a34a' : '#666'}>公开</Text>
              <Text fontSize="12px" color="#888" mt="4px">所有人可见</Text>
            </Flex>
            <Flex
              flex={1} direction="column" align="center" p="16px"
              border="2px solid" borderColor={form.is_private ? '#22c55e' : '#d1d5db'}
              rounded="10px" cursor="pointer" bg={form.is_private ? '#f0fdf4' : 'white'}
              onClick={function() { setForm(function(p) { return Object.assign({}, p, { is_private: true }) }) }}
              transition="all 0.15s"
            >
              <Text fontSize="24px" mb="6px">🔒</Text>
              <Text fontSize="14px" fontWeight="600" color={form.is_private ? '#16a34a' : '#666'}>私有</Text>
              <Text fontSize="12px" color="#888" mt="4px">仅自己可见</Text>
            </Flex>
          </Flex>
        </Box>

        <Flex align="center" justify="space-between" mb="24px" py="10px" borderBottom="1px solid" borderColor="#f0f0f0">
          <Box>
            <Text fontSize="13.5px" fontWeight="500" color="#555">初始化 README</Text>
            <Text fontSize="12px" color="#888">使用 README 文件初始化仓库</Text>
          </Box>
          <Switch colorScheme="green" isChecked={form.init_readme} onChange={updateField('init_readme')} />
        </Flex>

        <Flex justify="flex-end" gap="10px">
          <Button h="36px" px="16px" fontSize="13px" rounded="6px" variant="outline"
            borderColor="#d1d5db" color="#666" onClick={function() { navigate(-1) }}>
            取消
          </Button>
          <Button h="36px" px="24px" fontSize="14px" rounded="6px" bg="#22c55e" color="white"
            _hover={{ bg: '#16a34a' }} onClick={handleSubmit} isLoading={submitting}>
            创建项目
          </Button>
        </Flex>
      </Box>
    </Box>
  )
}

export default CreateProject
