import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Input,
  Spinner,
  Text,
  Textarea,
  useToast,
} from '@chakra-ui/react'
import { LuSettings, LuTriangleAlert } from 'react-icons/lu'
import { useAuth } from '../../contexts/AuthContext'
import { reposAPI } from '../../api/index'
import { t } from '../../i18n/index'

import SettingCard from '../../components/settings/SettingCard'
import SettingSection from '../../components/settings/SettingSection'
import ProjectTypeSelector from '../../components/settings/ProjectTypeSelector'
import DangerAction from '../../components/settings/DangerAction'

export default function ProjectSettings() {
  const { owner, repo } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { isGuest, isAdmin, isUser, user } = useAuth()
  const [repoInfo, setRepoInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    description: '',
    homepage: '',
    default_branch: '',
  })

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const cancelRef = useRef()

  const [transferOpen, setTransferOpen] = useState(false)
  const [transferTarget, setTransferTarget] = useState('')
  const [transferring, setTransferring] = useState(false)
  const transferCancelRef = useRef()

  useEffect(() => {
    setLoading(true)
    reposAPI.get(owner, repo).then((data) => {
      setRepoInfo(data)
      setForm({
        name: data.name || '',
        description: data.description || '',
        homepage: data.homepage || '',
        default_branch: data.default_branch || 'main',
      })
    }).catch(() => setRepoInfo(null)).finally(() => setLoading(false))
  }, [owner, repo])

  function updateField(key) {
    return function (e) {
      setForm((prev) => ({ ...prev, [key]: e.target.value }))
    }
  }

  function handleSave() {
    setSaving(true)
    reposAPI.update(owner, repo, form).then(() => {
      toast({ title: t('projectSettings.settingsSaved'), status: 'success', duration: 3000 })
      if (form.name !== repo) {
        navigate('/' + owner + '/' + form.name + '/settings')
      } else {
        return reposAPI.get(owner, repo).then(setRepoInfo)
      }
    }).catch((err) => {
      toast({ title: err.message || t('projectSettings.saveFailed'), status: 'error', duration: 3000 })
    }).finally(() => setSaving(false))
  }

  function handleTypeChange(newType) {
    setSaving(true)
    reposAPI.update(owner, repo, { project_type: newType }).then(() => {
      toast({ title: t('projectSettings.settingsSaved'), status: 'success', duration: 3000 })
      return reposAPI.get(owner, repo).then((data) => {
        setRepoInfo(data)
      })
    }).catch((err) => {
      toast({ title: err.message || t('projectSettings.saveFailed'), status: 'error', duration: 3000 })
    }).finally(() => setSaving(false))
  }

  function handleDelete() {
    setDeleting(true)
    reposAPI.del(owner, repo).then(() => {
      setDeleteOpen(false)
      navigate('/projects')
    }).catch((err) => {
      toast({ title: err.message || t('projectSettings.deleteRepoFailed'), status: 'error', duration: 3000 })
    }).finally(() => setDeleting(false))
  }

  function handleTransfer() {
    if (!transferTarget.trim()) return
    setTransferring(true)
    reposAPI.transfer(owner, repo, transferTarget.trim()).then(() => {
      setTransferOpen(false)
      setTransferTarget('')
      toast({ title: t('projectSettings.transferSuccess'), status: 'success', duration: 3000 })
      navigate('/projects')
    }).catch((err) => {
      toast({ title: err.message || t('projectSettings.transferFailed'), status: 'error', duration: 3000 })
    }).finally(() => setTransferring(false))
  }

  if (loading || !repoInfo) {
    return (
      <Box display="flex" justifyContent="center" py="60px">
        <Spinner size="lg" color="#22c55e" />
      </Box>
    )
  }

  const projectType = repoInfo.project_type || 'local'
  const hasWorkTree = repoInfo.storage_kind === 'work'
  const isRepoOwner = user && repoInfo.owner_id === user.id
  // 与后端一致：管理员、所有者可管理；未迁移的无主仓库允许登录用户管理。
  const canManage = !isGuest && (isAdmin || isRepoOwner || !repoInfo.owner_id)

  return (
    <>
      <HStack gap="8px" mb="20px">
        <LuSettings size={18} color="#333" />
        <Text fontSize="18px" fontWeight="700" color="#333">{t('projectSettings.title')}</Text>
      </HStack>

      <SettingCard>
        <SettingSection title={t('projectSettings.generalSettings')}>
          <Box mb="14px">
            <Text fontSize="13px" fontWeight="500" color="#555" mb="4px">{t('projectSettings.projectName')}</Text>
            <Input value={form.name} onChange={updateField('name')}
              h="36px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
              _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
          </Box>

          <Box mb="14px">
            <Text fontSize="13px" fontWeight="500" color="#555" mb="4px">{t('projectSettings.description')}</Text>
            <Textarea value={form.description} onChange={updateField('description')}
              fontSize="14px" borderRadius="8px" borderColor="#d1d5db" rows={3}
              _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
          </Box>

          <Box mb="14px">
            <Text fontSize="13px" fontWeight="500" color="#555" mb="4px">{t('projectSettings.homepage')}</Text>
            <Input value={form.homepage} onChange={updateField('homepage')}
              h="36px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
              placeholder="https://example.com"
              _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
          </Box>

          <Box mb="20px">
            <Text fontSize="13px" fontWeight="500" color="#555" mb="4px">{t('projectSettings.defaultBranch')}</Text>
            <Input value={form.default_branch} onChange={updateField('default_branch')}
              h="36px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
              _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
          </Box>

          <Button h="36px" px="20px" fontSize="14px" rounded="6px" bg="#22c55e" color="white"
            _hover={{ bg: '#16a34a' }} onClick={handleSave} isLoading={saving} isDisabled={isGuest}>
            {t('projectSettings.saveChanges')}
          </Button>
        </SettingSection>

        <SettingSection title={t('projectSettings.projectType')} description={t(`projectSettings.${projectType}ProjectDesc`)}>
          <ProjectTypeSelector currentType={projectType} onChange={handleTypeChange} disabled={!canManage || saving} />
        </SettingSection>

        <SettingSection
          title={t('storage.title')}
          description={repoInfo.storage_kind === 'work' ? t('storage.workDesc') : t('storage.bareDesc')}
        >
          <HStack gap="8px" mb="8px">
            <Badge px="8px" py="2px" rounded="full" fontSize="11.5px" fontWeight="600"
              bg={hasWorkTree ? '#dcfce7' : '#e0e7ff'} color={hasWorkTree ? '#15803d' : '#4338ca'}>
              {hasWorkTree ? t('storage.work') : t('storage.bare')}
            </Badge>
          </HStack>
          {repoInfo.local_path && (
            <Box bg="#f9fafb" border="1px solid" borderColor="#e5e7eb" rounded="6px" px="10px" py="8px">
              <Text fontSize="12px" color="#888" mb="2px">{t('storage.path')}</Text>
              <Text fontSize="12.5px" color="#333" fontFamily="mono" wordBreak="break-all">{repoInfo.local_path}</Text>
            </Box>
          )}
        </SettingSection>
      </SettingCard>

      <SettingCard borderColor="#fecaca">
        <Text fontSize="15px" fontWeight="600" color="#dc2626" mb="8px">{t('projectSettings.dangerZone')}</Text>
        <Text fontSize="13px" color="#666" mb="14px">{t('projectSettings.dangerZoneDesc')}</Text>

        {projectType !== 'local' && (
          <DangerAction
            title={t('projectSettings.transferOwnership')}
            description={t('projectSettings.transferDesc')}
            buttonText={t('projectSettings.transferProject')}
            buttonColor="#d97706"
            disabled={!canManage}
            onClick={() => { setTransferTarget(''); setTransferOpen(true) }}
          />
        )}

        <DangerAction
          title={t('projectSettings.deleteProject')}
          description={t('projectSettings.deleteWarning')}
          buttonText={t('projectSettings.deleteProject')}
          disabled={!canManage}
          onClick={() => { setDeleteConfirm(''); setDeleteOpen(true) }}
        />
      </SettingCard>

      <AlertDialog isOpen={transferOpen} leastDestructiveRef={transferCancelRef} onClose={() => setTransferOpen(false)}>
        <AlertDialogOverlay>
          <AlertDialogContent rounded="12px" maxW="420px">
            <AlertDialogHeader fontSize="16px" fontWeight="700" pb="0">
              <Flex align="center" gap="8px" color="#d97706">
                <LuTriangleAlert size={20} />
                <Text>{t('projectSettings.confirmTransfer')}</Text>
              </Flex>
            </AlertDialogHeader>
            <AlertDialogCloseButton top="14px" right="14px" />
            <AlertDialogBody py="16px">
              <Text fontSize="13px" color="#666" mb="12px">
                {t('projectSettings.transferWarning')}
              </Text>
              <Text fontSize="13px" color="#666" mb="12px">{t('projectSettings.typeNewOwner')}</Text>
              <Input
                value={transferTarget}
                onChange={(e) => setTransferTarget(e.target.value)}
                placeholder={t('projectSettings.newOwnerPlaceholder')}
                size="sm"
                rounded="6px"
                borderColor="#d1d5db"
                _focus={{ borderColor: '#f59e0b', boxShadow: '0 0 0 3px rgba(245,158,11,0.1)' }}
              />
            </AlertDialogBody>
            <AlertDialogFooter pt="0">
              <Button ref={transferCancelRef} onClick={() => setTransferOpen(false)}
                h="32px" px="16px" fontSize="13px" rounded="6px" variant="outline" borderColor="#d1d5db">
                {t('common.cancel')}
              </Button>
              <Button colorScheme="orange" onClick={handleTransfer} isLoading={transferring}
                isDisabled={!transferTarget.trim()}
                h="32px" px="16px" fontSize="13px" rounded="6px" ml="10px">
                {t('projectSettings.confirmTransfer')}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      <AlertDialog isOpen={deleteOpen} leastDestructiveRef={cancelRef} onClose={() => setDeleteOpen(false)}>
        <AlertDialogOverlay>
          <AlertDialogContent rounded="12px" maxW="420px">
            <AlertDialogHeader fontSize="16px" fontWeight="700" pb="0">
              <Flex align="center" gap="8px" color="#dc2626">
                <LuTriangleAlert size={20} />
                <Text>{t('projectSettings.confirmDeleteRepo')}</Text>
              </Flex>
            </AlertDialogHeader>
            <AlertDialogCloseButton top="14px" right="14px" />
            <AlertDialogBody py="16px">
              <Text fontSize="13px" color="#666" mb="12px">
                {t('projectSettings.deleteWarning')}
              </Text>
              <Text fontSize="13px" color="#666" mb="12px">{t('projectSettings.typeRepoName', { repo })}</Text>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={repo}
                size="sm"
                rounded="6px"
                borderColor="#d1d5db"
                _focus={{ borderColor: '#dc2626', boxShadow: '0 0 0 3px rgba(220,38,38,0.1)' }}
              />
            </AlertDialogBody>
            <AlertDialogFooter pt="0">
              <Button ref={cancelRef} onClick={() => setDeleteOpen(false)}
                h="32px" px="16px" fontSize="13px" rounded="6px" variant="outline" borderColor="#d1d5db">
                {t('common.cancel')}
              </Button>
              <Button colorScheme="red" onClick={handleDelete} isLoading={deleting}
                isDisabled={deleteConfirm !== repo}
                h="32px" px="16px" fontSize="13px" rounded="6px" ml="10px">
                {t('projectSettings.confirmDelete')}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  )
}
