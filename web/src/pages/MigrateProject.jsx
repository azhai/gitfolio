import React, { useState } from 'react'
import { Box, Text, Input, Textarea, Button, Flex, useToast, HStack } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { reposAPI } from '../api/index'
import { t } from '../i18n/index'
import { LuGlobe as Globe, LuLock as Lock, LuSparkles as Sparkles } from 'react-icons/lu'

const MigrateProject = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    clone_url: '',
    homepage: '',
    project_type: 'public',
  })

  function updateField(key) {
    return function(e) {
      var val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
      setForm(function(prev) { return Object.assign({}, prev, { [key]: val }) })
    }
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast({ title: t('migrateProject.nameRequired'), status: 'error', duration: 3000 })
      return
    }
    if (!form.clone_url.trim()) {
      toast({ title: t('migrateProject.urlRequired'), status: 'error', duration: 3000 })
      return
    }
    setSubmitting(true)
    reposAPI.create(form).then(function(data) {
      navigate('/' + (data.owner || 'ryan') + '/' + data.name)
    }).catch(function(err) {
      toast({ title: err.message || t('migrateProject.migrateFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setSubmitting(false) })
  }

  function handleDetect() {
    var url = form.clone_url.trim()
    if (!url) {
      toast({ title: t('migrateProject.enterUrlFirst'), status: 'warning', duration: 2500 })
      return
    }
    setDetecting(true)
    reposAPI.detectRepo(url).then(function(data) {
      setForm(function(prev) {
        return Object.assign({}, prev, {
          name: data.name || prev.name,
          description: data.description || prev.description,
          homepage: data.homepage || prev.homepage,
        })
      })
      toast({
        title: t('migrateProject.autoFilled'),
        description: (data.name || '') + (data.description ? ' - ' + data.description : ''),
        status: 'success',
        duration: 2500,
      })
    }).catch(function(err) {
      toast({ title: err.message || t('migrateProject.detectFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setDetecting(false) })
  }

  var types = [
    { key: 'public', icon: Globe, labelKey: 'common.public', descKey: 'migrateProject.publicDesc' },
    { key: 'private', icon: Lock, labelKey: 'common.private', descKey: 'migrateProject.privateDesc' },
  ]

  return (
    <Box maxW="720px" mx="auto">
      <Text fontSize="22px" fontWeight="700" color="#333" mb="24px">{t('migrateProject.title')}</Text>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="28px">
        <Box mb="18px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('migrateProject.remoteUrl')} *</Text>
          <Flex gap="10px">
            <Input value={form.clone_url} onChange={updateField('clone_url')}
              placeholder="https://github.com/user/repo.git" h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
              _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} flex={1} />
            <Button
              h="40px" px="16px" fontSize="13px" rounded="8px"
              bg={detecting ? '#e5e7eb' : '#8b5cf6'}
              color={detecting ? '#9ca3af' : 'white'}
              _hover={{ bg: detecting ? '#e5e7eb' : '#7c3aed' }}
              onClick={handleDetect}
              isLoading={detecting}
              loadingText={t('migrateProject.detecting')}
              leftIcon={<Sparkles size={16} />}
              whiteSpace="nowrap"
            >
              {detecting ? t('migrateProject.detecting') : t('migrateProject.autoFill')}
            </Button>
          </Flex>
          <Text fontSize="12px" color="#999" mt="4px">{t('migrateProject.urlHint')}</Text>
        </Box>

        <Box mb="18px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('migrateProject.projectName')} *</Text>
          <Input value={form.name} onChange={updateField('name')}
            placeholder="my-project" h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="18px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('migrateProject.description')}</Text>
          <Textarea value={form.description} onChange={updateField('description')}
            placeholder={t('migrateProject.descriptionOptional')} fontSize="14px" borderRadius="8px" borderColor="#d1d5db" rows={3}
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="18px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('migrateProject.homepage')}</Text>
          <Input value={form.homepage} onChange={updateField('homepage')}
            placeholder="https://example.com" h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
          <Text fontSize="12px" color="#999" mt="4px">{t('migrateProject.homepageHint')}</Text>
        </Box>

        <Box mb="24px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="12px">{t('migrateProject.projectType')}</Text>
          <Flex gap="12px">
            {types.map(function(tp) {
              var Icon = tp.icon
              var selected = form.project_type === tp.key
              return (
                <Flex
                  key={tp.key} flex={1} direction="column" align="center" p="14px"
                  border="2px solid" borderColor={selected ? '#22c55e' : '#d1d5db'}
                  rounded="10px" cursor="pointer" bg={selected ? '#f0fdf4' : 'white'}
                  onClick={function() { setForm(function(p) { return Object.assign({}, p, { project_type: tp.key }) }) }}
                  transition="all 0.15s"
                >
                  <Icon size={22} color={selected ? '#16a34a' : '#666'} mb="6px" />
                  <Text fontSize="13px" fontWeight="600" color={selected ? '#16a34a' : '#666'}>{t(tp.labelKey)}</Text>
                  <Text fontSize="11px" color="#888" mt="4px" textAlign="center">{t(tp.descKey)}</Text>
                </Flex>
              )
            })}
          </Flex>
        </Box>

        <Flex justify="flex-end" gap="10px">
          <Button h="36px" px="16px" fontSize="13px" rounded="6px" variant="outline"
            borderColor="#d1d5db" color="#666" onClick={function() { navigate(-1) }}>
            {t('common.cancel')}
          </Button>
          <Button h="36px" px="24px" fontSize="14px" rounded="6px" bg="#22c55e" color="white"
            _hover={{ bg: '#16a34a' }} onClick={handleSubmit} isLoading={submitting}>
            {t('migrateProject.migrateProject')}
          </Button>
        </Flex>
      </Box>
    </Box>
  )
}

export default MigrateProject
