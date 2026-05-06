import React, { useState, useEffect } from 'react'
import { Box, Text, Input, Textarea, Button, Flex, HStack, Badge, Spinner, useToast } from '@chakra-ui/react'
import { useParams, useNavigate } from 'react-router-dom'
import { issuesAPI, labelsAPI } from '../../api/index'

const NewIssue = () => {
  const { owner, repo } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState({ title: '', body: '', labels: [], assignee: '' })
  const [availableLabels, setAvailableLabels] = useState([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    labelsAPI.list(owner, repo).then(function(data) {
      setAvailableLabels(Array.isArray(data) ? data : [])
    }).catch(function() { setAvailableLabels([]) })
  }, [owner, repo])

  function toggleLabel(labelName) {
    setForm(function(prev) {
      var labels = prev.labels.slice()
      var idx = labels.indexOf(labelName)
      if (idx >= 0) labels.splice(idx, 1)
      else labels.push(labelName)
      return Object.assign({}, prev, { labels: labels })
    })
  }

  function handleSubmit() {
    if (!form.title.trim()) {
      toast({ title: '标题不能为空', status: 'error', duration: 3000 })
      return
    }
    setSubmitting(true)
    issuesAPI.create(owner, repo, form).then(function(data) {
      navigate('/' + owner + '/' + repo + '/issues/' + data.number)
    }).catch(function(err) {
      toast({ title: err.message || '创建议题失败', status: 'error', duration: 3000 })
    }).finally(function() { setSubmitting(false) })
  }

  return (
    <Box>
      <Text fontSize="18px" fontWeight="700" color="#333" mb="20px">⚠️ 新建议题</Text>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px">
        <Box mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">标题</Text>
          <Input value={form.title} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { title: e.target.value }) }) }}
            placeholder="议题标题" h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">描述</Text>
          <Textarea value={form.body} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { body: e.target.value }) }) }}
            placeholder="描述此议题..." fontSize="14px" borderRadius="8px" borderColor="#d1d5db" rows={8}
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">负责人</Text>
          <Input value={form.assignee} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { assignee: e.target.value }) }) }}
            placeholder="用户名" h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        {availableLabels.length > 0 && (
          <Box mb="20px">
            <Text fontSize="13px" fontWeight="600" color="#555" mb="8px">标签</Text>
            <HStack gap="6px" flexWrap="wrap">
              {availableLabels.map(function(label) {
                var name = label.name || label
                var isSelected = form.labels.indexOf(name) >= 0
                return (
                  <Badge key={name} fontSize="12px" px="8px" py="3px" rounded="12px" cursor="pointer"
                    bg={isSelected ? (label.color || '#22c55e') : '#f3f4f6'}
                    color={isSelected ? (label.text_color || 'white') : '#666'}
                    _hover={{ opacity: 0.8 }}
                    onClick={function() { toggleLabel(name) }}>
                    {name}
                  </Badge>
                )
              })}
            </HStack>
          </Box>
        )}

        <Flex justify="flex-end" gap="10px">
          <Button h="34px" px="16px" fontSize="13px" rounded="6px" variant="outline"
            borderColor="#d1d5db" color="#666" onClick={function() { navigate(-1) }}>
            取消
          </Button>
          <Button h="34px" px="20px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
            _hover={{ bg: '#16a34a' }} onClick={handleSubmit} isLoading={submitting}>
            创建议题
          </Button>
        </Flex>
      </Box>
    </Box>
  )
}

export default NewIssue
