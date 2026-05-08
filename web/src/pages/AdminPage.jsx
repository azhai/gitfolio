import React, { useState, useEffect } from 'react'
import { Box, Text, Flex, HStack, Badge, Button, Spinner, Input, Switch, useToast, Tabs, TabList, Tab, TabPanels, TabPanel } from '@chakra-ui/react'
import { usersAPI, adminAPI } from '../api/index'
import { t, timeAgo, getLanguage } from '../i18n/index'
import { LuUsers as Users, LuClock as Clock, LuShield as Shield, LuMail as Mail, LuCalendar as Calendar, LuRefreshCw as RefreshCw, LuPause as Pause, LuPlay as Play } from 'react-icons/lu'

function formatDateTime(dateStr) {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleString(getLanguage() === 'zh' ? 'zh-CN' : 'en-US', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
  } catch (e) {
    return dateStr
  }
}

function getIntervalLabel(seconds) {
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

var UserManagementTab = function() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(function() {
    usersAPI.list().then(function(data) {
      setUsers(Array.isArray(data) ? data : [])
    }).catch(function() { setUsers([]) }).finally(function() { setLoading(false) })
  }, [])

  var filtered = users.filter(function(u) {
    var q = search.toLowerCase()
    return ((u.username || '') + ' ' + (u.full_name || '') + ' ' + (u.email || '')).toLowerCase().indexOf(q) >= 0
  })

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="60px">
        <Spinner size="lg" color="#22c55e" />
      </Box>
    )
  }

  return (
    <Box>
      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="16px" mb="20px">
        <Input placeholder={t('admin.searchUser')} value={search} onChange={function(e) { setSearch(e.target.value) }}
          h="36px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
          _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
      </Box>

      <Box overflowX="auto">
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '10px', border: '1px solid #e2e2e2' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f0f0f0', fontSize: '13px', color: '#888', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>{t('admin.userCol')}</th>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>{t('admin.emailCol')}</th>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>{t('admin.roleCol')}</th>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>{t('admin.registeredAt')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(function(user) {
              return (
                <tr key={user.id || user.username} style={{ borderBottom: '1px solid #f0f0f0', fontSize: '14px' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <HStack gap="10px">
                      <Box w="32px" h="32px" rounded="full" bg="#f0fdf4" color="#16a34a" display="flex" alignItems="center" justifyContent="center" fontWeight={700} fontSize="13px" flexShrink={0}>
                        {(user.full_name || user.username || '?')[0].toUpperCase()}
                      </Box>
                      <Box>
                        <Text fontWeight={500} color="#333" fontSize="14px">{user.full_name || user.username}</Text>
                        <Text fontSize="12px" color="#888">@{user.username}</Text>
                      </Box>
                    </HStack>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#666' }}>
                    <HStack gap="5px">
                      <Mail size={13} />
                      <Text fontSize="13px">{user.email || '-'}</Text>
                    </HStack>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {user.is_admin ? (
                      <Badge fontSize="10px" px="6px" py="1px" rounded="4px" bg="#ede9fe" color="#7c3aed">
                        <HStack gap="4px"><Shield size={10} /><Text>{t('common.administrator')}</Text></HStack>
                      </Badge>
                    ) : (
                      <Badge fontSize="10px" px="6px" py="1px" rounded="4px" bg="#f3f4f6" color="#666">{t('common.user')}</Badge>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#888', fontSize: '13px' }}>
                    <HStack gap="5px">
                      <Calendar size={13} />
                      <Text>{timeAgo(user.created_at)}</Text>
                    </HStack>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Box>

      {!loading && filtered.length === 0 && (
        <Box textAlign="center" py="60px" color="#aaa">
          <Users size={40} color="#ccc" />
          <Text fontSize="15px" mt="8px">{t('admin.noUsers')}</Text>
        </Box>
      )}
    </Box>
  )
}

var SyncManagementTab = function() {
  const toast = useToast()
  const [syncPoints, setSyncPoints] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editValues, setEditValues] = useState({})

  function fetchSyncPoints() {
    setLoading(true)
    adminAPI.listSyncPoints().then(function(data) {
      setSyncPoints(data.sync_points || [])
    }).catch(function() { setSyncPoints([]) }).finally(function() { setLoading(false) })
  }

  useEffect(fetchSyncPoints, [])

  function startEdit(sp) {
    setEditingId(sp.id)
    setEditValues({
      sync_interval: sp.sync_interval || 0,
      is_paused: sp.is_paused || false,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValues({})
  }

  function saveEdit(id) {
    adminAPI.updateSyncPoint(id, editValues).then(function() {
      toast({ title: t('admin.updated'), status: 'success', duration: 2000 })
      setEditingId(null)
      setEditValues({})
      fetchSyncPoints()
    }).catch(function(err) {
      toast({ title: err.message || t('admin.updateFailed'), status: 'error', duration: 3000 })
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
      <Flex justify="space-between" align="center" mb="16px">
        <Text fontSize="14px" color="#888">{t('admin.totalScheduledTasks', { count: syncPoints.length })}</Text>
        <Button h="28px" px="12px" fontSize="12px" rounded="6px" variant="outline"
          borderColor="#d1d5db" color="#666" _hover={{ borderColor: '#22c55e', color: '#16a34a' }}
          leftIcon={<RefreshCw size={13} />}
          onClick={fetchSyncPoints}>{t('common.refresh')}</Button>
      </Flex>

      <Box overflowX="auto">
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '10px', border: '1px solid #e2e2e2' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f0f0f0', fontSize: '12px', color: '#888', textAlign: 'left' }}>
              <th style={{ padding: '10px 14px', fontWeight: 500 }}>{t('admin.projectCol')}</th>
              <th style={{ padding: '10px 14px', fontWeight: 500 }}>{t('admin.typeCol')}</th>
              <th style={{ padding: '10px 14px', fontWeight: 500 }}>{t('admin.intervalCol')}</th>
              <th style={{ padding: '10px 14px', fontWeight: 500 }}>{t('admin.statusCol')}</th>
              <th style={{ padding: '10px 14px', fontWeight: 500 }}>{t('admin.lastSyncCol')}</th>
              <th style={{ padding: '10px 14px', fontWeight: 500 }}>{t('admin.nextSyncCol')}</th>
              <th style={{ padding: '10px 14px', fontWeight: 500 }}>{t('common.operation')}</th>
            </tr>
          </thead>
          <tbody>
            {syncPoints.map(function(sp) {
              var isEditing = editingId === sp.id
              return (
                <tr key={sp.id} style={{ borderBottom: '1px solid #f0f0f0', fontSize: '13px' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <Text fontWeight={500} color="#333">{sp.owner_name}/{sp.repo_name}</Text>
                    {sp.project_type && <Badge ml="6px" fontSize="9px" px="4px" rounded="3px"
                      bg={sp.project_type === 'mirror' ? '#eff6ff' : '#f3f4f6'}
                      color={sp.project_type === 'mirror' ? '#2563eb' : '#6b7280'}>
                      {sp.project_type === 'mirror' ? t('project.mirror') : t('common.local')}
                    </Badge>}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <Badge fontSize="10px" px="6px" py="1px" rounded="4px"
                      bg={sp.sync_type === 'mirror' ? '#dbeafe' : '#fef3c7'}
                      color={sp.sync_type === 'mirror' ? '#2563eb' : '#d97706'}>
                      {sp.sync_type === 'mirror' ? t('admin.mirrorSync') : t('admin.statsRefresh')}
                    </Badge>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {isEditing ? (
                      <HStack gap="4px">
                        <Input type="number" value={secondsToHM(editValues.sync_interval).hours} size="sm" w="60px" fontSize="12px"
                          min={0} max={999}
                          onChange={function(e) {
                            var val = parseInt(e.target.value) || 0
                            if (val < 0) val = 0
                            if (val > 999) val = 999
                            var m = secondsToHM(editValues.sync_interval).minutes
                            setEditValues(Object.assign({}, editValues, { sync_interval: hmToSeconds(val, m) }))
                          }} />
                        <Text fontSize="12px" color="#888">{t('common.hour')}</Text>
                        <Input type="number" value={secondsToHM(editValues.sync_interval).minutes} size="sm" w="55px" fontSize="12px"
                          min={0} max={59}
                          onChange={function(e) {
                            var val = parseInt(e.target.value) || 0
                            if (val < 0) val = 0
                            if (val > 59) val = 59
                            var h = secondsToHM(editValues.sync_interval).hours
                            setEditValues(Object.assign({}, editValues, { sync_interval: hmToSeconds(h, val) }))
                          }} />
                        <Text fontSize="12px" color="#888">{t('common.minute')}</Text>
                      </HStack>
                    ) : (
                      <Text color="#555">{getIntervalLabel(sp.sync_interval)}</Text>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {isEditing ? (
                      <HStack gap="6px">
                        {editValues.sync_interval > 0 ? (
                          <>
                            <Switch colorScheme="green" size="sm" isChecked={!editValues.is_paused}
                              onChange={function(e) { setEditValues(Object.assign({}, editValues, { is_paused: !e.target.checked })) }} />
                            <Text fontSize="12px" color={editValues.is_paused ? '#dc2626' : '#16a34a'}>
                              {editValues.is_paused ? t('common.paused') : t('common.running')}
                            </Text>
                          </>
                        ) : (
                          <Text fontSize="12px" color="#888">{t('common.manual')}</Text>
                        )}
                      </HStack>
                    ) : sp.sync_interval === 0 ? (
                      <Text fontSize="12px" color="#888">{t('common.manual')}</Text>
                    ) : sp.is_paused ? (
                      <HStack gap="4px" color="#dc2626">
                        <Pause size={13} />
                        <Text fontSize="12px">{t('common.paused')}</Text>
                      </HStack>
                    ) : (
                      <HStack gap="4px" color="#16a34a">
                        <Play size={13} />
                        <Text fontSize="12px">{t('common.running')}</Text>
                      </HStack>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#888', fontSize: '12px' }}>
                    {sp.last_sync_at ? formatDateTime(sp.last_sync_at) : '-'}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#888', fontSize: '12px' }}>
                    {!sp.is_paused && sp.next_sync_at ? formatDateTime(sp.next_sync_at) : '-'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {isEditing ? (
                      <HStack gap="6px">
                        <Button h="24px" px="10px" fontSize="11px" rounded="4px"
                          bg="#22c55e" color="white" _hover={{ bg: '#16a34a' }}
                          onClick={function() { saveEdit(sp.id) }}>{t('common.save')}</Button>
                        <Button h="24px" px="10px" fontSize="11px" rounded="4px"
                          variant="outline" borderColor="#d1d5db" color="#666"
                          onClick={cancelEdit}>{t('common.cancel')}</Button>
                      </HStack>
                    ) : (
                      <Button h="24px" px="10px" fontSize="11px" rounded="4px"
                        variant="outline" borderColor="#d1d5db" color="#666"
                        _hover={{ borderColor: '#22c55e', color: '#16a34a' }}
                        onClick={function() { startEdit(sp) }}>{t('common.edit')}</Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Box>

      {!loading && syncPoints.length === 0 && (
        <Box textAlign="center" py="60px" color="#aaa">
          <Clock size={40} color="#ccc" />
          <Text fontSize="15px" mt="8px">{t('admin.noScheduledTasks')}</Text>
          <Text fontSize="13px" mt="4px">{t('admin.noScheduledTasksHint')}</Text>
        </Box>
      )}
    </Box>
  )
}

var AdminPage = function() {
  return (
    <Box maxW="960px" mx="auto">
      <HStack gap="8px" mb="24px">
        <Shield size={20} color="#333" />
        <Text fontSize="20px" fontWeight={700} color="#333">{t('admin.title')}</Text>
      </HStack>

      <Tabs colorScheme="green" mb="20px">
        <TabList borderColor="#e5e7eb" pb={0}>
          <Tab fontSize="13px" fontWeight={500} _selected={{ color: '#16a34a', borderColor: '#16a34a' }}>
            <HStack gap="5px"><Users size={14} /><Text>{t('admin.userManagement')}</Text></HStack>
          </Tab>
          <Tab fontSize="13px" fontWeight={500} _selected={{ color: '#16a34a', borderColor: '#16a34a' }}>
            <HStack gap="5px"><Clock size={14} /><Text>{t('admin.scheduledTasks')}</Text></HStack>
          </Tab>
        </TabList>

        <TabPanels>
          <TabPanel p={0}>
            <UserManagementTab />
          </TabPanel>
          <TabPanel p={0}>
            <SyncManagementTab />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  )
}

export default AdminPage
