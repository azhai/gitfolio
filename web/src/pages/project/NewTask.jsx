import React, { useState, useEffect } from 'react'
import { Box, Text, Input, Textarea, Button, Flex, Select, HStack, Badge, useToast } from '@chakra-ui/react'
import { useParams, useNavigate } from 'react-router-dom'
import { tasksAPI, reposAPI } from '../../api/index'

var PRIORITY_OPTIONS = [
  { value: 1, label: 'P1 - 紧急', color: '#dc2626' },
  { value: 2, label: 'P2 - 高', color: '#f97316' },
  { value: 3, label: 'P3 - 中', color: '#eab308' },
  { value: 4, label: 'P4 - 低', color: '#22c55e' },
  { value: 5, label: 'P5 - 最低', color: '#3b82f6' },
]

const NewTask = () => {
  const { owner, repo } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    title: '',
    goal: '',
    draft: '',
    priority: 3,
    handler: '',
    verifier: '',
    review_at: '',
  })

  function handleSubmit() {
    if (!form.title.trim()) {
      toast({ title: '请输入任务标题', status: 'error', duration: 3000 })
      return
    }
    setSubmitting(true)
    tasksAPI.create(owner, repo, form).then(function(data) {
      navigate('/' + owner + '/' + repo + '/tasks/' + data.id)
    }).catch(function(err) {
      toast({ title: err.message || '创建任务失败', status: 'error', duration: 3000 })
    }).finally(function() { setSubmitting(false) })
  }

  return (
    <Box>
      <Text fontSize="18px" fontWeight="700" color="#333" mb="20px">📋 新建任务</Text>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px">
        <Box mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">标题 *</Text>
          <Input value={form.title} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { title: e.target.value }) }) }}
            placeholder="任务标题" h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">目标</Text>
          <Textarea value={form.goal} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { goal: e.target.value }) }) }}
            placeholder="任务目标描述..." fontSize="14px" borderRadius="8px" borderColor="#d1d5db" rows={4}
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">草稿/方案</Text>
          <Textarea value={form.draft} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { draft: e.target.value }) }) }}
            placeholder="实现方案或草稿..." fontSize="14px" borderRadius="8px" borderColor="#d1d5db" rows={4}
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">优先级</Text>
          <HStack gap="8px" flexWrap="wrap">
            {PRIORITY_OPTIONS.map(function(opt) {
              var isActive = form.priority === opt.value
              return (
                <Badge key={opt.value} fontSize="12px" px="10px" py="4px" rounded="6px" cursor="pointer"
                  bg={isActive ? opt.color : '#f3f4f6'}
                  color={isActive ? 'white' : '#666'}
                  _hover={{ opacity: 0.8 }}
                  onClick={function() { setForm(function(p) { return Object.assign({}, p, { priority: opt.value }) }) }}>
                  {opt.label}
                </Badge>
              )
            })}
          </HStack>
        </Box>

        <Flex gap="16px" mb="20px">
          <Box flex={1}>
            <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">处理人</Text>
            <Input value={form.handler} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { handler: e.target.value }) }) }}
              placeholder="用户名" h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
              _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
          </Box>
          <Box flex={1}>
            <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">验证人</Text>
            <Input value={form.verifier} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { verifier: e.target.value }) }) }}
              placeholder="用户名" h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
              _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
          </Box>
        </Flex>

        <Box mb="20px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">评审时间</Text>
          <Input type="datetime-local" value={form.review_at} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { review_at: e.target.value }) }) }}
            h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Flex justify="flex-end" gap="10px">
          <Button h="34px" px="16px" fontSize="13px" rounded="6px" variant="outline"
            borderColor="#d1d5db" color="#666" onClick={function() { navigate(-1) }}>
            取消
          </Button>
          <Button h="34px" px="20px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
            _hover={{ bg: '#16a34a' }} onClick={handleSubmit} isLoading={submitting}>
            创建任务
          </Button>
        </Flex>
      </Box>
    </Box>
  )
}

export default NewTask
