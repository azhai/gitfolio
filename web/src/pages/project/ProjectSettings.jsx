import React, { useState, useEffect } from 'react'
import { Box, Text, Flex, VStack, HStack, Badge, Button, Spinner, Input, Textarea, Switch, useToast } from '@chakra-ui/react'
import { useParams, useNavigate } from 'react-router-dom'
import { reposAPI } from '../../api/index'

const ProjectSettings = () => {
  const { owner, repo } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [repoInfo, setRepoInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState({ pull: false, push: false })
  const [form, setForm] = useState({ name: '', description: '', homepage: '', is_private: false, default_branch: '' })

  useEffect(() => {
    reposAPI.get(owner, repo).then(function(data) {
      setRepoInfo(data)
      setForm({
        name: data.name || '',
        description: data.description || '',
        homepage: data.homepage || '',
        is_private: data.is_private || false,
        default_branch: data.default_branch || 'main',
      })
    }).catch(function() { setRepoInfo(null) }).finally(function() { setLoading(false) })
  }, [owner, repo])

  function updateField(key) {
    return function(e) {
      var val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
      setForm(function(prev) { return Object.assign({}, prev, { [key]: val }) })
    }
  }

  function handleSave() {
    setSaving(true)
    reposAPI.update(owner, repo, form).then(function() {
      toast({ title: '设置已保存', status: 'success', duration: 3000 })
      if (form.name !== repo) {
        navigate('/' + owner + '/' + form.name + '/settings')
      }
    }).catch(function(err) {
      toast({ title: err.message || '保存失败', status: 'error', duration: 3000 })
    }).finally(function() { setSaving(false) })
  }

  function handleSyncPull() {
    setSyncing(function(p) { return Object.assign({}, p, { pull: true }) })
    reposAPI.syncPull(owner, repo).then(function() {
      toast({ title: '拉取同步已开始', status: 'success', duration: 3000 })
    }).catch(function(err) {
      toast({ title: err.message || '同步失败', status: 'error', duration: 3000 })
    }).finally(function() { setSyncing(function(p) { return Object.assign({}, p, { pull: false }) }) })
  }

  function handleSyncPush() {
    setSyncing(function(p) { return Object.assign({}, p, { push: true }) })
    reposAPI.syncPush(owner, repo).then(function() {
      toast({ title: '推送同步已开始', status: 'success', duration: 3000 })
    }).catch(function(err) {
      toast({ title: err.message || '同步失败', status: 'error', duration: 3000 })
    }).finally(function() { setSyncing(function(p) { return Object.assign({}, p, { push: false }) }) })
  }

  function handleDelete() {
    if (!window.confirm('确定要删除此仓库吗？此操作无法撤销。')) return
    reposAPI.del(owner, repo).then(function() {
      navigate('/projects')
    }).catch(function(err) {
      alert(err.message || '删除仓库失败')
    })
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
      <Text fontSize="18px" fontWeight="700" color="#333" mb="20px">⚙️ 项目设置</Text>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px" mb="20px">
        <Text fontSize="15px" fontWeight="600" color="#333" mb="16px">基本设置</Text>

        <Box mb="14px">
          <Text fontSize="13px" fontWeight="500" color="#555" mb="4px">项目名称</Text>
          <Input value={form.name} onChange={updateField('name')}
            h="36px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="14px">
          <Text fontSize="13px" fontWeight="500" color="#555" mb="4px">描述</Text>
          <Textarea value={form.description} onChange={updateField('description')}
            fontSize="14px" borderRadius="8px" borderColor="#d1d5db" rows={3}
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="14px">
          <Text fontSize="13px" fontWeight="500" color="#555" mb="4px">主页</Text>
          <Input value={form.homepage} onChange={updateField('homepage')}
            h="36px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            placeholder="https://example.com"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="14px">
          <Text fontSize="13px" fontWeight="500" color="#555" mb="4px">默认分支</Text>
          <Input value={form.default_branch} onChange={updateField('default_branch')}
            h="36px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Flex align="center" justify="space-between" mb="16px" py="10px" borderBottom="1px solid" borderColor="#f0f0f0">
          <Box>
            <Text fontSize="13px" fontWeight="500" color="#555">私有仓库</Text>
            <Text fontSize="12px" color="#888">仅对成员可见</Text>
          </Box>
          <Switch colorScheme="green" isChecked={form.is_private} onChange={updateField('is_private')} />
        </Flex>

        <Button h="36px" px="20px" fontSize="14px" rounded="6px" bg="#22c55e" color="white"
          _hover={{ bg: '#16a34a' }} onClick={handleSave} isLoading={saving}>
          保存更改
        </Button>
      </Box>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px" mb="20px">
        <Text fontSize="15px" fontWeight="600" color="#333" mb="12px">代码同步</Text>
        <Text fontSize="13px" color="#666" mb="14px">
          从远程仓库拉取最新代码或推送本地代码到远程仓库。
          {repoInfo && repoInfo.mirror_url && <Text as="span" display="block" mt="6px">镜像地址: <Text as="span" fontWeight="500" color="#333">{repoInfo.mirror_url}</Text></Text>}
        </Text>
        <HStack gap="10px">
          <Button h="32px" px="16px" fontSize="13px" rounded="6px" variant="outline"
            borderColor="#22c55e" color="#16a34a" _hover={{ bg: '#f0fdf4' }}
            onClick={handleSyncPull} isLoading={syncing.pull}>
            从远程拉取
          </Button>
          <Button h="32px" px="16px" fontSize="13px" rounded="6px" variant="outline"
            borderColor="#22c55e" color="#16a34a" _hover={{ bg: '#f0fdf4' }}
            onClick={handleSyncPush} isLoading={syncing.push}>
            推送到远程
          </Button>
        </HStack>
      </Box>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px" mb="20px">
        <Text fontSize="15px" fontWeight="600" color="#333" mb="12px">统计刷新</Text>
        <Text fontSize="13px" color="#666" mb="14px">手动刷新仓库统计数据（语言分布、提交活动等）。</Text>
        <Button h="32px" px="16px" fontSize="13px" rounded="6px" variant="outline"
          borderColor="#d1d5db" color="#666" _hover={{ borderColor: '#22c55e', color: '#16a34a' }}
          onClick={function() {
            reposAPI.refreshStats(owner, repo).then(function() {
              toast({ title: '统计已刷新', status: 'success', duration: 3000 })
            }).catch(function(err) {
              toast({ title: err.message || '刷新失败', status: 'error', duration: 3000 })
            })
          }}>
          刷新统计
        </Button>
      </Box>

      <Box bg="white" border="1px solid" borderColor="#fecaca" rounded="10px" p="24px">
        <Text fontSize="15px" fontWeight="600" color="#dc2626" mb="8px">危险区域</Text>
        <Text fontSize="13px" color="#666" mb="14px">删除仓库后无法恢复，请谨慎操作。</Text>
        <Button h="30px" px="14px" fontSize="13px" rounded="6px" bg="#dc2626" color="white"
          _hover={{ bg: '#b91c1c' }} onClick={handleDelete}>
          删除此项目
        </Button>
      </Box>
    </Box>
  )
}

export default ProjectSettings
