import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Box,
  Button,
  Flex,
  HStack,
  IconButton,
  Input,
  Spinner,
  Text,
  useToast,
} from '@chakra-ui/react'
import { LuRefreshCw, LuTrash2 } from 'react-icons/lu'
import { useAuth } from '../../contexts/AuthContext'
import { reposAPI } from '../../api/index'
import { t } from '../../i18n/index'

import SettingCard from '../../components/settings/SettingCard'
import SettingSection from '../../components/settings/SettingSection'
import GitActionCard from '../../components/settings/GitActionCard'
import SyncConfigPanel from '../../components/settings/SyncConfigPanel'
import SyncLogsPanel from '../../components/settings/SyncLogsPanel'

export default function ProjectSync() {
  const { owner, repo } = useParams()
  const toast = useToast()
  const { isGuest, user } = useAuth()
  const [repoInfo, setRepoInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState({ pull: false, issues: false, push: {} })

  const [syncConfig, setSyncConfig] = useState(null)
  const [syncConfigDraft, setSyncConfigDraft] = useState(null)
  const [syncSaving, setSyncSaving] = useState(false)
  const [syncLogs, setSyncLogs] = useState([])
  const [remoteUrl, setRemoteUrl] = useState('')

  const [remotes, setRemotes] = useState([])
  const [loadingRemotes, setLoadingRemotes] = useState(false)
  const [newRemoteName, setNewRemoteName] = useState('')
  const [newRemoteUrl, setNewRemoteUrl] = useState('')
  const [addingRemote, setAddingRemote] = useState(false)

  useEffect(() => {
    setLoading(true)
    reposAPI.get(owner, repo).then((data) => {
      setRepoInfo(data)
      setRemoteUrl(data.mirror_url || '')
    }).catch(() => setRepoInfo(null)).finally(() => setLoading(false))
  }, [owner, repo])

  const projectType = repoInfo ? repoInfo.project_type || 'local' : 'local'
  const isRemote = ['mirror', 'public', 'private'].includes(projectType)
  const canPushRemote = ['public', 'private', 'local'].includes(projectType)
  const isRepoOwner = user && repoInfo && repoInfo.owner_id === user.id
  const canManage = projectType === 'local' ? !isGuest : (isRepoOwner || !isGuest)

  useEffect(() => {
    if (!repoInfo) return
    reposAPI.getSyncConfig(owner, repo).then((data) => {
      setSyncConfig(data)
      setSyncConfigDraft(data)
    }).catch(() => {
      setSyncConfig(null)
      setSyncConfigDraft(null)
    })
    reposAPI.getSyncLogs(owner, repo).then((data) => {
      setSyncLogs(data.logs || [])
    }).catch(() => setSyncLogs([]))
  }, [owner, repo, repoInfo])

  useEffect(() => {
    if (projectType !== 'local') return
    fetchRemotes()
  }, [owner, repo, repoInfo, projectType])

  function fetchRemotes() {
    setLoadingRemotes(true)
    reposAPI.getRemotes(owner, repo).then((data) => {
      setRemotes(data.remotes || [])
    }).catch(() => setRemotes([])).finally(() => setLoadingRemotes(false))
  }

  const lastSyncText = syncConfig && syncConfig.last_sync_at
    ? t('projectSettings.lastSync') + ': ' + new Date(syncConfig.last_sync_at).toLocaleString()
    : t('projectSettings.lastSync') + ': ' + t('projectSettings.never')

  function setPushLoading(name, value) {
    setSyncing((p) => ({ ...p, push: { ...p.push, [name]: value } }))
  }

  function handleSyncPull() {
    setSyncing((p) => ({ ...p, pull: true }))
    reposAPI.syncPull(owner, repo).then(() => {
      toast({ title: t('projectSettings.pullCodeStarted'), status: 'success', duration: 3000 })
    }).catch((err) => {
      toast({ title: err.message || t('projectSettings.syncFailed'), status: 'error', duration: 3000 })
    }).finally(() => setSyncing((p) => ({ ...p, pull: false })))
  }

  function handleSyncIssues() {
    setSyncing((p) => ({ ...p, issues: true }))
    var beforeLogID = 0
    reposAPI.getSyncLogs(owner, repo).then((data) => {
      const logs = data.logs || []
      if (logs.length > 0) beforeLogID = logs[0].id || 0
    }).catch(() => {}).then(() => {
      return reposAPI.syncIssues(owner, repo)
    }).then(() => {
      toast({ title: t('projectSettings.syncStarted'), status: 'info', duration: 3000 })
      var pollCount = 0
      var pollTimer = setInterval(() => {
        pollCount++
        if (pollCount > 100) {
          clearInterval(pollTimer)
          setSyncing((p) => ({ ...p, issues: false }))
          return
        }
        reposAPI.getSyncLogs(owner, repo).then((data) => {
          const logs = data.logs || []
          setSyncLogs(logs)
          for (var i = 0; i < logs.length; i++) {
            const log = logs[i]
            if (log.id <= beforeLogID) break
            if (log.status === 'success') {
              clearInterval(pollTimer)
              setSyncing((p) => ({ ...p, issues: false }))
              const count = log.items_synced || 0
              if (count > 0) {
                toast({ title: t('projectSettings.issuesSyncResult', { count }), status: 'success', duration: 3000 })
              } else {
                toast({ title: t('projectSettings.issuesSyncStarted'), status: 'success', duration: 3000 })
              }
              return
            } else if (log.status === 'failure') {
              clearInterval(pollTimer)
              setSyncing((p) => ({ ...p, issues: false }))
              toast({ title: t('projectSettings.syncFailed'), status: 'error', duration: 3000 })
              return
            }
          }
        }).catch(() => {})
      }, 10000)
    }).catch((err) => {
      toast({ title: err.message || t('projectSettings.syncFailed'), status: 'error', duration: 3000 })
      setSyncing((p) => ({ ...p, issues: false }))
    })
  }

  function handleSyncPush() {
    const pushUrl = remoteUrl || (repoInfo && repoInfo.mirror_url) || ''
    if (!pushUrl) {
      toast({ title: t('projectSettings.remoteUrlRequired'), status: 'warning', duration: 3000 })
      return
    }
    setPushLoading('_url', true)
    reposAPI.syncPush(owner, repo, pushUrl).then(() => {
      toast({ title: t('projectSettings.pushSyncStarted'), status: 'success', duration: 3000 })
    }).catch((err) => {
      toast({ title: err.message || t('projectSettings.syncFailed'), status: 'error', duration: 3000 })
    }).finally(() => setPushLoading('_url', false))
  }

  function handlePushRemote(remoteName) {
    setPushLoading(remoteName, true)
    reposAPI.syncPush(owner, repo, '', remoteName).then(() => {
      toast({ title: t('projectSettings.pushSyncStarted'), status: 'success', duration: 3000 })
    }).catch((err) => {
      toast({ title: err.message || t('projectSettings.syncFailed'), status: 'error', duration: 3000 })
    }).finally(() => setPushLoading(remoteName, false))
  }

  function handleAddRemote() {
    if (!newRemoteName.trim() || !newRemoteUrl.trim()) return
    setAddingRemote(true)
    reposAPI.addRemote(owner, repo, newRemoteName.trim(), newRemoteUrl.trim()).then(() => {
      toast({ title: t('projectSettings.remoteAdded'), status: 'success', duration: 3000 })
      setNewRemoteName('')
      setNewRemoteUrl('')
      fetchRemotes()
    }).catch((err) => {
      toast({ title: err.message || t('projectSettings.addRemoteFailed'), status: 'error', duration: 3000 })
    }).finally(() => setAddingRemote(false))
  }

  function handleRemoveRemote(remoteName) {
    reposAPI.removeRemote(owner, repo, remoteName).then(() => {
      toast({ title: t('projectSettings.remoteRemoved'), status: 'success', duration: 3000 })
      fetchRemotes()
    }).catch((err) => {
      toast({ title: err.message || t('projectSettings.removeRemoteFailed'), status: 'error', duration: 3000 })
    })
  }

  function handleSyncConfigSave() {
    setSyncSaving(true)
    reposAPI.updateSyncConfig(owner, repo, {
      sync_interval: syncConfigDraft.sync_interval,
      is_paused: syncConfigDraft.is_paused,
    }).then((data) => {
      setSyncConfig(data)
      setSyncConfigDraft(data)
      toast({ title: t('projectSettings.syncConfigSaved'), status: 'success', duration: 3000 })
    }).catch((err) => {
      toast({ title: err.message || t('projectSettings.saveFailed'), status: 'error', duration: 3000 })
    }).finally(() => setSyncSaving(false))
  }

  function handleRefreshLogs() {
    reposAPI.getSyncLogs(owner, repo).then((data) => {
      setSyncLogs(data.logs || [])
    }).catch(() => {})
  }

  function handleRefreshStats() {
    reposAPI.refreshStats(owner, repo).then(() => {
      toast({ title: t('projectSettings.statsRefreshed'), status: 'success', duration: 3000 })
    }).catch((err) => {
      toast({ title: err.message || t('projectSettings.refreshFailed'), status: 'error', duration: 3000 })
    })
  }

  function handleIdentifyContributors() {
    reposAPI.refreshContributors(owner, repo).then(() => {
      toast({ title: t('projectSettings.identifyContributorsStarted'), status: 'success', duration: 3000 })
    }).catch((err) => {
      toast({ title: err.message || t('projectSettings.identifyContributorsFailed'), status: 'error', duration: 3000 })
    })
  }

  if (loading || !repoInfo) {
    return (
      <Box display="flex" justifyContent="center" py="60px">
        <Spinner size="lg" color="#22c55e" />
      </Box>
    )
  }

  return (
    <Box>
      <HStack gap="8px" mb="20px">
        <LuRefreshCw size={18} color="#333" />
        <Text fontSize="18px" fontWeight="700" color="#333">{t('projectSettings.codeSync')}</Text>
      </HStack>

      <SettingCard>
        <SettingSection title={t('projectSettings.statsRefreshSection')} description={t('projectSettings.statsRefreshDesc')}>
          <HStack gap="8px">
            <Button h="32px" px="16px" fontSize="13px" rounded="6px" variant="outline"
              borderColor="#d1d5db" color="#666" _hover={{ borderColor: '#22c55e', color: '#16a34a' }}
              onClick={handleRefreshStats} isDisabled={isGuest}>
              {t('projectSettings.refreshStats')}
            </Button>
            <Button h="32px" px="16px" fontSize="13px" rounded="6px" variant="outline"
              borderColor="#d1d5db" color="#666" _hover={{ borderColor: '#22c55e', color: '#16a34a' }}
              onClick={handleIdentifyContributors} isDisabled={isGuest || projectType === 'local'}>
              {t('projectSettings.identifyContributors')}
            </Button>
          </HStack>
        </SettingSection>
      </SettingCard>

      <SettingCard>
        <SettingSection
          title={t('projectSettings.codeSync')}
          description={projectType === 'local' ? t('projectSettings.codeSyncLocalDesc') : t('projectSettings.codeSyncDesc')}
        >
          <Flex gap="12px" flexWrap="wrap" mb="16px">
            {isRemote && (
              <GitActionCard
                title={t('projectSettings.pullCode')}
                description="从远程仓库拉取最新代码。"
                buttonText={t('projectSettings.pullCode')}
                statusText={lastSyncText}
                isLoading={syncing.pull}
                disabled={isGuest}
                onClick={handleSyncPull}
              />
            )}
            {isRemote && (
              <GitActionCard
                title={t('projectSettings.pullIssues')}
                description="从 GitHub 同步 Issues 和 PRs。"
                buttonText={t('projectSettings.pullIssues')}
                buttonColor="#2563eb"
                isLoading={syncing.issues}
                disabled={isGuest}
                onClick={handleSyncIssues}
              />
            )}
            {projectType !== 'local' && canPushRemote && (
              <GitActionCard
                title={t('projectSettings.pushToRemote')}
                description="推送本地代码到远程仓库。"
                buttonText={t('projectSettings.pushToRemote')}
                buttonColor="#6b7280"
                isLoading={syncing.push._url}
                disabled={isGuest}
                onClick={handleSyncPush}
              />
            )}
          </Flex>

          {projectType !== 'local' && (
            <Box mb="14px">
              <Text fontSize="13px" fontWeight="500" color="#555" mb="4px">{t('projectSettings.remoteUrlLabel')}</Text>
              <Input value={remoteUrl} onChange={(e) => setRemoteUrl(e.target.value)}
                placeholder={t('projectSettings.remoteUrlPlaceholder')}
                h="36px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
                _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
            </Box>
          )}

          {projectType === 'local' && (
            <Box>
              <Text fontSize="13px" fontWeight="500" color="#555" mb="8px">{t('projectSettings.remoteRepositories')}</Text>

              {loadingRemotes ? (
                <Spinner size="sm" color="#22c55e" />
              ) : remotes.length === 0 ? (
                <Text fontSize="13px" color="#888" mb="12px">{t('projectSettings.noRemotes')}</Text>
              ) : (
                <Box border="1px solid" borderColor="#e2e2e2" rounded="8px" overflow="hidden" mb="14px">
                  {remotes.map((remote, idx) => (
                    <Flex key={remote.name} align="center" justify="space-between"
                      p="12px" borderBottom={idx < remotes.length - 1 ? '1px solid' : 'none'} borderColor="#f0f0f0"
                      bg={idx % 2 === 0 ? 'white' : '#fafafa'}>
                      <Box>
                        <Text fontSize="13px" fontWeight="600" color="#333">{remote.name}</Text>
                        <Text fontSize="12px" color="#888">{remote.fetch_url}</Text>
                        {remote.push_urls && remote.push_urls.length > 0 && remote.push_urls[0] !== remote.fetch_url && (
                          <Text fontSize="12px" color="#888">push: {remote.push_urls.join(', ')}</Text>
                        )}
                      </Box>
                      <HStack gap="8px">
                        <Button size="xs" h="28px" fontSize="12px" variant="outline" color="#22c55e" borderColor="#22c55e"
                          isLoading={syncing.push[remote.name]} isDisabled={isGuest}
                          onClick={() => handlePushRemote(remote.name)}>
                          {t('projectSettings.pushToRemote')}
                        </Button>
                        <IconButton size="xs" h="28px" w="28px" variant="ghost" color="#888" icon={<LuTrash2 size={14} />}
                          aria-label={t('projectSettings.removeRemote')} isDisabled={isGuest}
                          onClick={() => handleRemoveRemote(remote.name)} />
                      </HStack>
                    </Flex>
                  ))}
                </Box>
              )}

              <Flex gap="8px" flexWrap="wrap" align="flex-end">
                <Box>
                  <Text fontSize="12px" color="#888" mb="4px">{t('projectSettings.remoteName')}</Text>
                  <Input value={newRemoteName} onChange={(e) => setNewRemoteName(e.target.value)}
                    placeholder="origin" h="36px" fontSize="13px" w="140px" borderRadius="8px" borderColor="#d1d5db"
                    _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
                </Box>
                <Box flex="1" minW="200px">
                  <Text fontSize="12px" color="#888" mb="4px">{t('projectSettings.remoteUrl')}</Text>
                  <Input value={newRemoteUrl} onChange={(e) => setNewRemoteUrl(e.target.value)}
                    placeholder="https://github.com/user/repo.git" h="36px" fontSize="13px" borderRadius="8px" borderColor="#d1d5db"
                    _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
                </Box>
                <Button h="36px" px="16px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
                  _hover={{ bg: '#16a34a' }} onClick={handleAddRemote} isLoading={addingRemote}
                  isDisabled={!newRemoteName.trim() || !newRemoteUrl.trim() || isGuest}>
                  {t('projectSettings.addRemote')}
                </Button>
              </Flex>
            </Box>
          )}
        </SettingSection>
      </SettingCard>

      {isRemote && (
        <SettingCard>
          <SettingSection title={t('projectSettings.scheduledSync')} description={t('projectSettings.scheduledSyncMirrorDesc')}>
            <SyncConfigPanel
              config={syncConfigDraft}
              onChange={setSyncConfigDraft}
              onSave={handleSyncConfigSave}
              isSaving={syncSaving}
              disabled={!canManage}
            />
          </SettingSection>
        </SettingCard>
      )}

      {isRemote && (
        <SettingCard>
          <SyncLogsPanel logs={syncLogs} onRefresh={handleRefreshLogs} />
        </SettingCard>
      )}

    </Box>
  )
}
