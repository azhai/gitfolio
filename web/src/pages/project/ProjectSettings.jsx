import React, { useState, useEffect, useRef } from 'react'
import { Box, Text, Flex, VStack, HStack, Badge, Button, Spinner, Input, Textarea, Switch, useToast, AlertDialog, AlertDialogBody, AlertDialogFooter, AlertDialogHeader, AlertDialogContent, AlertDialogOverlay, AlertDialogCloseButton } from '@chakra-ui/react'
import { useParams, useNavigate } from 'react-router-dom'
import { reposAPI } from '../../api/index'
import { t, timeAgo, getLanguage } from '../../i18n/index'
import { LuSettings as Settings, LuTriangleAlert as AlertTriangle, LuClock as Clock, LuCircleCheck as CheckCircle, LuCircleX as XCircle, LuRefreshCw as RefreshCw } from 'react-icons/lu'
import { useAuth } from '../../contexts/AuthContext'

function formatIntervalLabel(seconds) {
  if (!seconds || seconds === 0) return t('common.manual')
  var h = Math.floor(seconds / 3600)
  var m = Math.floor((seconds % 3600) / 60)
  if (h > 0 && m > 0) return h + ' ' + t('common.hour') + ' ' + m + ' ' + t('common.minute')
  if (h > 0) return h + ' ' + t('common.hour')
  if (m > 0) return m + ' ' + t('common.minute')
  return seconds + ' ' + t('common.second')
}

function secondsToHM(seconds) {
  var s = seconds || 0
  return { hours: Math.floor(s / 3600), minutes: Math.floor((s % 3600) / 60) }
}

function hmToSeconds(hours, minutes) {
  return (hours || 0) * 3600 + (minutes || 0) * 60
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-'
  try {
    var d = new Date(dateStr)
    if (d.getFullYear() < 2) return '-'
    return d.toLocaleString(getLanguage() === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
  } catch (e) {
    return dateStr
  }
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return '-'
  if (ms < 1000) return ms + ' ms'
  return (ms / 1000).toFixed(1) + ' ' + t('common.second')
}

const ProjectSettings = () => {
  const { owner, repo } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { isGuest, isAdmin, isUser, user } = useAuth()
  const [repoInfo, setRepoInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState({ pull: false, issues: false, push: false })
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferTarget, setTransferTarget] = useState('')
  const [transferring, setTransferring] = useState(false)
  const cancelRef = useRef()
  const transferCancelRef = useRef()
  const [form, setForm] = useState({ name: '', description: '', homepage: '', project_type: 'local', default_branch: '' })

  const [syncConfig, setSyncConfig] = useState(null)
  const [syncSaving, setSyncSaving] = useState(false)
  const [syncLogs, setSyncLogs] = useState([])
  const [remoteUrl, setRemoteUrl] = useState('')

  useEffect(() => {
    reposAPI.get(owner, repo).then(function(data) {
      setRepoInfo(data)
      setRemoteUrl(data.mirror_url || '')
      setForm({
        name: data.name || '',
        description: data.description || '',
        homepage: data.homepage || '',
        project_type: data.project_type || 'local',
        default_branch: data.default_branch || 'main',
      })
    }).catch(function() { setRepoInfo(null) }).finally(function() { setLoading(false) })
  }, [owner, repo])

  useEffect(function() {
    reposAPI.getSyncConfig(owner, repo).then(function(data) {
      setSyncConfig(data)
    }).catch(function() { setSyncConfig(null) })
    reposAPI.getSyncLogs(owner, repo).then(function(data) {
      setSyncLogs(data.logs || [])
    }).catch(function() { setSyncLogs([]) })
  }, [owner, repo])

  function updateField(key) {
    return function(e) {
      var val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
      setForm(function(prev) { return Object.assign({}, prev, { [key]: val }) })
    }
  }

  function handleSave() {
    setSaving(true)
    var payload = Object.assign({}, form, { mirror_url: remoteUrl })
    reposAPI.update(owner, repo, payload).then(function() {
      toast({ title: t('projectSettings.settingsSaved'), status: 'success', duration: 3000 })
      if (form.name !== repo) {
        navigate('/' + owner + '/' + form.name + '/settings')
      }
    }).catch(function(err) {
      toast({ title: err.message || t('projectSettings.saveFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setSaving(false) })
  }

  function handleSyncPull() {
    setSyncing(function(p) { return Object.assign({}, p, { pull: true }) })
    reposAPI.syncPull(owner, repo).then(function() {
      toast({ title: t('projectSettings.pullCodeStarted'), status: 'success', duration: 3000 })
    }).catch(function(err) {
      toast({ title: err.message || t('projectSettings.syncFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setSyncing(function(p) { return Object.assign({}, p, { pull: false }) }) })
  }

  function handleSyncIssues() {
    setSyncing(function(p) { return Object.assign({}, p, { issues: true }) })
    reposAPI.syncIssues(owner, repo).then(function(data) {
      var msg = t('projectSettings.issuesSyncStarted')
      if (data && data.total_synced > 0) {
        msg = t('projectSettings.issuesSyncResult', { count: data.total_synced })
      }
      toast({ title: msg, status: 'success', duration: 3000 })
    }).catch(function(err) {
      toast({ title: err.message || t('projectSettings.syncFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setSyncing(function(p) { return Object.assign({}, p, { issues: false }) }) })
  }

  function handleSyncPush() {
    var pushUrl = remoteUrl || (repoInfo && repoInfo.mirror_url) || ''
    if (!pushUrl) {
      toast({ title: t('projectSettings.remoteUrlRequired'), status: 'warning', duration: 3000 })
      return
    }
    setSyncing(function(p) { return Object.assign({}, p, { push: true }) })
    reposAPI.syncPush(owner, repo, pushUrl).then(function() {
      toast({ title: t('projectSettings.pushSyncStarted'), status: 'success', duration: 3000 })
    }).catch(function(err) {
      toast({ title: err.message || t('projectSettings.syncFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setSyncing(function(p) { return Object.assign({}, p, { push: false }) }) })
  }

  function handleDelete() {
    setDeleting(true)
    reposAPI.del(owner, repo).then(function() {
      setDeleteOpen(false)
      navigate('/projects')
    }).catch(function(err) {
      toast({ title: err.message || t('projectSettings.deleteRepoFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setDeleting(false) })
  }

  function handleTransfer() {
    if (!transferTarget.trim()) return
    setTransferring(true)
    reposAPI.transfer(owner, repo, transferTarget.trim()).then(function() {
      setTransferOpen(false)
      setTransferTarget('')
      toast({ title: t('projectSettings.transferSuccess'), status: 'success', duration: 3000 })
      navigate('/projects')
    }).catch(function(err) {
      toast({ title: err.message || t('projectSettings.transferFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setTransferring(false) })
  }

  function handleSyncConfigSave() {
    setSyncSaving(true)
    reposAPI.updateSyncConfig(owner, repo, {
      sync_interval: syncConfig.sync_interval,
      is_paused: syncConfig.is_paused,
    }).then(function(data) {
      setSyncConfig(data)
      toast({ title: t('projectSettings.syncConfigSaved'), status: 'success', duration: 3000 })
    }).catch(function(err) {
      toast({ title: err.message || t('projectSettings.saveFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setSyncSaving(false) })
  }

  function handleRefreshLogs() {
    reposAPI.getSyncLogs(owner, repo).then(function(data) {
      setSyncLogs(data.logs || [])
    }).catch(function() {})
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="60px">
        <Spinner size="lg" color="#22c55e" />
      </Box>
    )
  }

  var isMirror = repoInfo && repoInfo.project_type === 'mirror'
  var isPublic = repoInfo && repoInfo.project_type === 'public'
  var isPrivate = repoInfo && repoInfo.project_type === 'private'
  var isLocal = repoInfo && repoInfo.project_type === 'local'
  var isRemote = isMirror || isPublic || isPrivate
  var canPushRemote = isPublic || isPrivate
  var isRepoOwner = repoInfo && user && repoInfo.owner_id === user.id
  var canManage = isLocal ? !isGuest : (isAdmin || isUser || isRepoOwner)

  return (
    <Box>
      <HStack gap="8px" mb="20px">
        <Settings size={18} color="#333" />
        <Text fontSize="18px" fontWeight="700" color="#333">{t('projectSettings.title')}</Text>
      </HStack>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px" mb="20px">
        <Text fontSize="15px" fontWeight="600" color="#333" mb="16px">{t('projectSettings.generalSettings')}</Text>

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

        <Box mb="14px">
          <Text fontSize="13px" fontWeight="500" color="#555" mb="4px">{t('projectSettings.defaultBranch')}</Text>
          <Input value={form.default_branch} onChange={updateField('default_branch')}
            h="36px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Flex align="center" justify="space-between" mb="16px" py="10px" borderBottom="1px solid" borderColor="#f0f0f0">
          <Box>
            <Text fontSize="13px" fontWeight="500" color="#555">{t('projectSettings.projectType')}</Text>
            <Text fontSize="12px" color="#888">
              {isMirror ? t('projectSettings.mirrorProjectDesc')
                : isPublic ? t('projectSettings.publicProjectDesc')
                : isPrivate ? t('projectSettings.privateProjectDesc')
                : t('projectSettings.localProjectDesc')}
            </Text>
          </Box>
          <HStack gap="6px">
            {(function() {
              var currentType = repoInfo.project_type || 'local'
              var allowedTypes
              if (currentType === 'local') {
                allowedTypes = ['local']
              } else if (currentType === 'mirror') {
                allowedTypes = ['mirror', 'public', 'private']
              } else {
                allowedTypes = ['public', 'private']
              }
              return allowedTypes.map(function(pt) {
                var labelMap = { mirror: 'project.mirror', public: 'project.public', private: 'project.private', local: 'common.local' }
                var colorMap = { mirror: '#2563eb', public: '#16a34a', private: '#ea580c', local: '#6b7280' }
                var selected = form.project_type === pt
                return (
                  <Box key={pt} as="button" px="10px" py="4px" fontSize="12px" fontWeight="500" rounded="6px"
                    border="1px solid" cursor="pointer" transition="all 0.15s"
                    borderColor={selected ? colorMap[pt] : '#d1d5db'}
                    bg={selected ? (pt === 'mirror' ? '#eff6ff' : pt === 'public' ? '#f0fdf4' : pt === 'private' ? '#fff7ed' : '#f3f4f6') : 'white'}
                    color={selected ? colorMap[pt] : '#888'}
                    _hover={{ borderColor: colorMap[pt] }}
                    onClick={function() { setForm(function(p) { return Object.assign({}, p, { project_type: pt }) }) }}
                  >
                    {t(labelMap[pt])}
                  </Box>
                )
              })
            })()}
          </HStack>
        </Flex>

        <Button h="36px" px="20px" fontSize="14px" rounded="6px" bg="#22c55e" color="white"
          _hover={{ bg: '#16a34a' }} onClick={handleSave} isLoading={saving} isDisabled={isGuest}>
          {t('projectSettings.saveChanges')}
        </Button>
      </Box>

      {isRemote && (<>
      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px" mb="20px">
        <Text fontSize="15px" fontWeight="600" color="#333" mb="12px">{t('projectSettings.scheduledSync')}</Text>
        <Text fontSize="13px" color="#666" mb="16px">
          {t('projectSettings.scheduledSyncMirrorDesc')}
        </Text>

        {syncConfig ? (
          <Box>
            <Box mb="14px">
              <Text fontSize="13px" fontWeight="500" color="#555" mb="4px">{t('projectSettings.syncInterval')}</Text>
              <HStack gap="8px">
                <Input type="number" value={secondsToHM(syncConfig.sync_interval).hours}
                  h="36px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db" w="80px"
                  min={0} max={999}
                  _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }}
                  onChange={function(e) {
                    var val = parseInt(e.target.value) || 0
                    if (val < 0) val = 0
                    if (val > 999) val = 999
                    var m = secondsToHM(syncConfig.sync_interval).minutes
                    setSyncConfig(Object.assign({}, syncConfig, { sync_interval: hmToSeconds(val, m) }))
                  }} />
                <Text fontSize="14px" color="#555">{t('common.hour')}</Text>
                <Input type="number" value={secondsToHM(syncConfig.sync_interval).minutes}
                  h="36px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db" w="80px"
                  min={0} max={59}
                  _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }}
                  onChange={function(e) {
                    var val = parseInt(e.target.value) || 0
                    if (val < 0) val = 0
                    if (val > 59) val = 59
                    var h = secondsToHM(syncConfig.sync_interval).hours
                    setSyncConfig(Object.assign({}, syncConfig, { sync_interval: hmToSeconds(h, val) }))
                  }} />
                <Text fontSize="14px" color="#555">{t('common.minute')}</Text>
              </HStack>
              <Text fontSize="12px" color="#999" mt="4px">{t('projectSettings.syncIntervalHint')}</Text>
            </Box>

            {syncConfig.sync_interval > 0 && (
              <Flex align="center" justify="space-between" py="10px" borderBottom="1px solid" borderColor="#f0f0f0" mb="14px">
                <Box>
                  <Text fontSize="13px" fontWeight="500" color="#555">{t('projectSettings.enableScheduledSync')}</Text>
                  <Text fontSize="12px" color="#888">{syncConfig.is_paused ? t('projectSettings.currentlyPaused') : t('projectSettings.currentlyRunning')}</Text>
                </Box>
                <Switch colorScheme="green" isChecked={!syncConfig.is_paused}
                  onChange={function(e) {
                    setSyncConfig(Object.assign({}, syncConfig, { is_paused: !e.target.checked }))
                  }} />
              </Flex>
            )}

            <Box mb="16px" fontSize="12px" color="#888">
              <Flex align="center" gap="6px" mb="6px">
                <Clock size={13} />
                <Text>{t('projectSettings.lastSync')}: {syncConfig.last_sync_at ? timeAgo(syncConfig.last_sync_at) : t('projectSettings.never')}</Text>
              </Flex>
              {syncConfig.sync_interval > 0 && !syncConfig.is_paused && syncConfig.next_sync_at && (
                <Flex align="center" gap="6px" mb="6px">
                  <RefreshCw size={13} />
                  <Text>{t('projectSettings.nextSync')}: {timeAgo(syncConfig.next_sync_at)}</Text>
                </Flex>
              )}
              {syncConfig.last_error && (
                <Flex align="center" gap="6px" color="#dc2626">
                  <XCircle size={13} />
                  <Text>{t('projectSettings.recentError')}: {syncConfig.last_error}</Text>
                </Flex>
              )}
            </Box>

            <Button h="36px" px="20px" fontSize="14px" rounded="6px" bg="#22c55e" color="white"
              _hover={{ bg: '#16a34a' }} onClick={handleSyncConfigSave} isLoading={syncSaving} isDisabled={isGuest}>
              {t('projectSettings.saveSyncConfig')}
            </Button>
          </Box>
        ) : (
          <Text fontSize="13px" color="#aaa">{t('projectSettings.loadingSyncConfig')}</Text>
        )}
      </Box>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px" mb="20px">
        <Flex align="center" justify="space-between" mb="12px">
          <Text fontSize="15px" fontWeight="600" color="#333">{t('projectSettings.syncLogs')}</Text>
          <Button h="26px" px="10px" fontSize="12px" rounded="4px" variant="ghost"
            color="#888" _hover={{ color: '#16a34a' }}
            onClick={handleRefreshLogs}>
            <RefreshCw size={13} />
          </Button>
        </Flex>

        {syncLogs.length === 0 ? (
          <Text fontSize="13px" color="#aaa">{t('projectSettings.noSyncLogs')}</Text>
        ) : (
          <VStack spacing="0" align="stretch">
            {syncLogs.map(function(log, idx) {
              var isSuccess = log.status === 'success'
              return (
                <Flex key={log.id || idx} align="center" justify="space-between"
                  py="10px" borderBottom={idx < syncLogs.length - 1 ? '1px solid' : 'none'}
                  borderColor="#f0f0f0">
                  <Flex align="center" gap="8px">
                    {isSuccess
                      ? <CheckCircle size={14} color="#16a34a" />
                      : <XCircle size={14} color="#dc2626" />}
                    <Box>
                      <Text fontSize="13px" color="#333" fontWeight="500">
                        {log.sync_type === 'mirror' ? t('projectSettings.mirrorSync') : t('projectSettings.statsRefresh')}
                        {' '}{isSuccess ? t('projectSettings.success') : t('projectSettings.failed')}
                      </Text>
                      {log.message && (
                        <Text fontSize="12px" color="#888" noOfLines={1}>{log.message}</Text>
                      )}
                    </Box>
                  </Flex>
                  <Flex align="center" gap="12px" fontSize="12px" color="#888">
                    <Text>{formatDuration(log.duration)}</Text>
                    <Text>{formatDateTime(log.created_at)}</Text>
                  </Flex>
                </Flex>
              )
            })}
          </VStack>
        )}
      </Box>
      </>)}

      {isRemote && (
      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px" mb="20px">
        <Text fontSize="15px" fontWeight="600" color="#333" mb="12px">{t('projectSettings.codeSync')}</Text>
        <Text fontSize="13px" color="#666" mb="14px">
          {t('projectSettings.codeSyncDesc')}
        </Text>
        <Box mb="14px">
          <Text fontSize="13px" fontWeight="500" color="#555" mb="4px">{t('projectSettings.remoteUrlLabel')}</Text>
          <Input value={remoteUrl} onChange={function(e) { setRemoteUrl(e.target.value) }}
            placeholder={t('projectSettings.remoteUrlPlaceholder')}
            h="36px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>
        <HStack gap="10px" flexWrap="wrap">
          {isRemote && (
            <Button h="32px" px="16px" fontSize="13px" rounded="6px" variant="outline"
              borderColor="#22c55e" color="#16a34a" _hover={{ bg: '#f0fdf4' }}
              onClick={handleSyncPull} isLoading={syncing.pull} isDisabled={isGuest}>
              {t('projectSettings.pullCode')}
            </Button>
          )}
          {isRemote && (
            <Button h="32px" px="16px" fontSize="13px" rounded="6px" variant="outline"
              borderColor="#3b82f6" color="#2563eb" _hover={{ bg: '#eff6ff' }}
              onClick={handleSyncIssues} isLoading={syncing.issues} isDisabled={isGuest}>
              {t('projectSettings.pullIssues')}
            </Button>
          )}
          {canPushRemote && (
            <Button h="32px" px="16px" fontSize="13px" rounded="6px" variant="outline"
              borderColor="#d1d5db" color="#666" _hover={{ borderColor: '#22c55e', color: '#16a34a' }}
              onClick={handleSyncPush} isLoading={syncing.push} isDisabled={isGuest}>
              {t('projectSettings.pushToRemote')}
            </Button>
          )}
        </HStack>
      </Box>
      )}

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px" mb="20px">
        <Text fontSize="15px" fontWeight="600" color="#333" mb="12px">{t('projectSettings.statsRefreshSection')}</Text>
        <Text fontSize="13px" color="#666" mb="14px">{t('projectSettings.statsRefreshDesc')}</Text>
        <Button h="32px" px="16px" fontSize="13px" rounded="6px" variant="outline"
          borderColor="#d1d5db" color="#666" _hover={{ borderColor: '#22c55e', color: '#16a34a' }}
          onClick={function() {
            reposAPI.refreshStats(owner, repo).then(function() {
              toast({ title: t('projectSettings.statsRefreshed'), status: 'success', duration: 3000 })
            }).catch(function(err) {
              toast({ title: err.message || t('projectSettings.refreshFailed'), status: 'error', duration: 3000 })
            })
          }} isDisabled={isGuest}>
          {t('projectSettings.refreshStats')}
        </Button>
      </Box>

      <Box bg="white" border="1px solid" borderColor="#fecaca" rounded="10px" p="24px">
        <Text fontSize="15px" fontWeight="600" color="#dc2626" mb="8px">{t('projectSettings.dangerZone')}</Text>
        <Text fontSize="13px" color="#666" mb="14px">{t('projectSettings.dangerZoneDesc')}</Text>

        {isRemote && (
          <Flex align="center" justify="space-between" mb="14px" py="10px" borderBottom="1px solid" borderColor="#fecaca">
            <Box>
              <Text fontSize="13px" fontWeight="500" color="#555">{t('projectSettings.transferOwnership')}</Text>
              <Text fontSize="12px" color="#888">{t('projectSettings.transferDesc')}</Text>
            </Box>
            <Button h="30px" px="14px" fontSize="13px" rounded="6px" variant="outline"
              borderColor="#f59e0b" color="#d97706" _hover={{ bg: '#fffbeb' }}
              onClick={function() { setTransferTarget(''); setTransferOpen(true) }} isDisabled={!canManage}>
              {t('projectSettings.transferProject')}
            </Button>
          </Flex>
        )}

        <Button h="30px" px="14px" fontSize="13px" rounded="6px" bg="#dc2626" color="white"
          _hover={{ bg: '#b91c1c' }} onClick={function() { setDeleteConfirm(''); setDeleteOpen(true) }} isDisabled={!canManage}>
          {t('projectSettings.deleteProject')}
        </Button>
      </Box>

      <AlertDialog isOpen={transferOpen} leastDestructiveRef={transferCancelRef} onClose={function() { setTransferOpen(false) }}>
        <AlertDialogOverlay>
          <AlertDialogContent rounded="12px" maxW="420px">
            <AlertDialogHeader fontSize="16px" fontWeight="700" pb="0">
              <Flex align="center" gap="8px" color="#d97706">
                <AlertTriangle size={20} />
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
                onChange={function(e) { setTransferTarget(e.target.value) }}
                placeholder={t('projectSettings.newOwnerPlaceholder')}
                size="sm"
                rounded="6px"
                borderColor="#d1d5db"
                _focus={{ borderColor: '#f59e0b', boxShadow: '0 0 0 3px rgba(245,158,11,0.1)' }}
              />
            </AlertDialogBody>
            <AlertDialogFooter pt="0">
              <Button ref={transferCancelRef} onClick={function() { setTransferOpen(false) }}
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

      <AlertDialog isOpen={deleteOpen} leastDestructiveRef={cancelRef} onClose={function() { setDeleteOpen(false) }}>
        <AlertDialogOverlay>
          <AlertDialogContent rounded="12px" maxW="420px">
            <AlertDialogHeader fontSize="16px" fontWeight="700" pb="0">
              <Flex align="center" gap="8px" color="#dc2626">
                <AlertTriangle size={20} />
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
                onChange={function(e) { setDeleteConfirm(e.target.value) }}
                placeholder={repo}
                size="sm"
                rounded="6px"
                borderColor="#d1d5db"
                _focus={{ borderColor: '#dc2626', boxShadow: '0 0 0 3px rgba(220,38,38,0.1)' }}
              />
            </AlertDialogBody>
            <AlertDialogFooter pt="0">
              <Button ref={cancelRef} onClick={function() { setDeleteOpen(false) }}
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
    </Box>
  )
}

export default ProjectSettings
