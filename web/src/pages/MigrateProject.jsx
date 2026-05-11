import React, { useState } from 'react'
import { Box, Text, Input, Textarea, Button, Flex, useToast, HStack } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { reposAPI } from '../api/index'
import { t } from '../i18n/index'
import { LuGlobe as Globe, LuSparkles as Sparkles, LuEye as Eye, LuLock as Lock } from 'react-icons/lu'

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
    project_type: 'mirror',
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
    reposAPI.create(Object.assign({}, form)).then(function(data) {
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
          <HStack gap="10px" align="stretch">
            {[
              { key: 'mirror', icon: Globe, color: '#2563eb', border: '#2563eb', bg: '#eff6ff', label: t('project.mirror'), desc: t('migrateProject.mirrorDesc') },
              { key: 'public', icon: Eye, color: '#16a34a', border: '#16a34a', bg: '#f0fdf4', label: t('project.public'), desc: t('migrateProject.publicDesc') },
              { key: 'private', icon: Lock, color: '#ea580c', border: '#ea580c', bg: '#fff7ed', label: t('project.private'), desc: t('migrateProject.privateDesc') },
            ].map(function(pt) {
              var selected = form.project_type === pt.key
              var Icon = pt.icon
              return (
                <Box key={pt.key} flex={1} as="button" type="button"
                  direction="column" align="center" p="14px"
                  border="2px solid" borderColor={selected ? pt.border : '#e2e2e2'}
                  rounded="10px" bg={selected ? pt.bg : 'white'}
                  cursor="pointer" transition="all 0.15s"
                  _hover={{ borderColor: pt.border }}
                  onClick={function() { setForm(function(p) { return Object.assign({}, p, { project_type: pt.key }) }) }}
                  display="flex" flexDirection="column" alignItems="center"
                >
                  <Icon size={22} color={pt.color} />
                  <Text fontSize="13px" fontWeight="600" color={pt.color} mt="6px">{pt.label}</Text>
                  <Text fontSize="11px" color="#888" mt="4px" textAlign="center">{pt.desc}</Text>
                </Box>
              )
            })}
          </HStack>
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
