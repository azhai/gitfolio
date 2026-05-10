import React, { useState, useEffect } from 'react'
import { Box, Text, Flex, HStack, VStack, Badge, Button, Spinner, Input, Switch, useToast, Tabs, TabList, Tab, TabPanels, TabPanel, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, Select, useDisclosure } from '@chakra-ui/react'
import { usersAPI, adminAPI } from '../api/index'
import { t, timeAgo, getLanguage } from '../i18n/index'
import { LuUsers as Users, LuClock as Clock, LuShield as Shield, LuMail as Mail, LuCalendar as Calendar, LuRefreshCw as RefreshCw, LuPause as Pause, LuPlay as Play, LuFileText as FileText, LuCircleCheck as CheckCircle, LuCircleX as XCircle, LuTimer as Timer, LuPlus as Plus } from 'react-icons/lu'

function formatDateTime(dateStr) {
  if (!dateStr) return '-'
  try {
    var d = new Date(dateStr)
    if (d.getFullYear() < 2) return '-'
    return d.toLocaleString(getLanguage() === 'zh' ? 'zh-CN' : 'en-US', {
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
  const toast = useToast()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [form, setForm] = useState({ username: '', email: '', password: '', full_name: '', role: 'user' })
  const [creating, setCreating] = useState(false)

  function fetchUsers() {
    setLoading(true)
    usersAPI.list().then(function(data) {
      setUsers(Array.isArray(data) ? data : [])
    }).catch(function() { setUsers([]) }).finally(function() { setLoading(false) })
  }

  useEffect(fetchUsers, [])

  var filtered = users.filter(function(u) {
    var q = search.toLowerCase()
    return ((u.username || '') + ' ' + (u.full_name || '') + ' ' + (u.email || '')).toLowerCase().indexOf(q) >= 0
  })

  function handleCreate() {
    if (!form.username) { toast({ title: t('userMgmt.usernameRequired'), status: 'warning', duration: 2000 }); return }
    if (!form.email) { toast({ title: t('userMgmt.emailRequired'), status: 'warning', duration: 2000 }); return }
    if (!form.password) { toast({ title: t('userMgmt.passwordRequired'), status: 'warning', duration: 2000 }); return }
    if (form.password.length < 6) { toast({ title: t('userMgmt.passwordMinLength'), status: 'warning', duration: 2000 }); return }

    setCreating(true)
    usersAPI.create(form).then(function() {
      toast({ title: t('common.success'), status: 'success', duration: 2000 })
      setForm({ username: '', email: '', password: '', full_name: '', role: 'user' })
      onClose()
      fetchUsers()
    }).catch(function(err) {
      var msg = err.message || t('userMgmt.createFailed')
      if (msg.indexOf('username already exists') >= 0) msg = t('userMgmt.usernameExists')
      if (msg.indexOf('email already exists') >= 0) msg = t('userMgmt.emailExists')
      toast({ title: msg, status: 'error', duration: 3000 })
    }).finally(function() { setCreating(false) })
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
        <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="12px 16px" flex={1} mr="12px">
          <Input placeholder={t('admin.searchUser')} value={search} onChange={function(e) { setSearch(e.target.value) }}
            h="32px" fontSize="13px" borderRadius="6px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>
        <Button h="32px" px="14px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
          _hover={{ bg: '#16a34a' }} leftIcon={<Plus size={14} />} onClick={onOpen}>
          {t('userMgmt.newUser')}
        </Button>
      </Flex>

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
                    {user.role === 'admin' ? (
                      <Badge fontSize="10px" px="6px" py="1px" rounded="4px" bg="#ede9fe" color="#7c3aed">
                        <HStack gap="4px"><Shield size={10} /><Text>{t('common.administrator')}</Text></HStack>
                      </Badge>
                    ) : user.role === 'leader' ? (
                      <Badge fontSize="10px" px="6px" py="1px" rounded="4px" bg="#dbeafe" color="#2563eb">{t('common.administrator')}</Badge>
                    ) : user.role === 'guest' ? (
                      <Badge fontSize="10px" px="6px" py="1px" rounded="4px" bg="#fef3c7" color="#d97706">{t('nav.login')}</Badge>
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

      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent mx="16px">
          <ModalHeader fontSize="16px" fontWeight={600}>{t('userMgmt.newUser')}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb="6px">
            <VStack spacing="12px">
              <Box w="100%">
                <Text fontSize="12px" color="#888" mb="4px">{t('userMgmt.username')}</Text>
                <Input h="36px" fontSize="13px" value={form.username} placeholder={t('userMgmt.username')}
                  onChange={function(e) { setForm(Object.assign({}, form, { username: e.target.value })) }}
                  borderColor="#d1d5db" _focus={{ borderColor: '#22c55e' }} />
              </Box>
              <Box w="100%">
                <Text fontSize="12px" color="#888" mb="4px">{t('userMgmt.email')}</Text>
                <Input h="36px" fontSize="13px" type="email" value={form.email} placeholder={t('userMgmt.email')}
                  onChange={function(e) { setForm(Object.assign({}, form, { email: e.target.value })) }}
                  borderColor="#d1d5db" _focus={{ borderColor: '#22c55e' }} />
              </Box>
              <Box w="100%">
                <Text fontSize="12px" color="#888" mb="4px">{t('userMgmt.password')}</Text>
                <Input h="36px" fontSize="13px" type="password" value={form.password} placeholder={t('userMgmt.passwordMinLength')}
                  onChange={function(e) { setForm(Object.assign({}, form, { password: e.target.value })) }}
                  borderColor="#d1d5db" _focus={{ borderColor: '#22c55e' }} />
              </Box>
              <Box w="100%">
                <Text fontSize="12px" color="#888" mb="4px">{t('userMgmt.fullName')}</Text>
                <Input h="36px" fontSize="13px" value={form.full_name} placeholder={t('userMgmt.fullName')}
                  onChange={function(e) { setForm(Object.assign({}, form, { full_name: e.target.value })) }}
                  borderColor="#d1d5db" _focus={{ borderColor: '#22c55e' }} />
              </Box>
              <Box w="100%">
                <Text fontSize="12px" color="#888" mb="4px">{t('userMgmt.role')}</Text>
                <Select h="36px" fontSize="13px" value={form.role}
                  onChange={function(e) { setForm(Object.assign({}, form, { role: e.target.value })) }}
                  borderColor="#d1d5db" _focus={{ borderColor: '#22c55e' }}>
                  <option value="user">{t('common.user')}</option>
                  <option value="leader">Leader</option>
                  <option value="admin">{t('common.administrator')}</option>
                  <option value="guest">Guest</option>
                </Select>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter pt="8px">
            <Button h="32px" px="14px" fontSize="13px" rounded="6px" variant="outline" borderColor="#d1d5db" color="#666"
              mr="8px" onClick={onClose}>{t('common.cancel')}</Button>
            <Button h="32px" px="14px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
              _hover={{ bg: '#16a34a' }} isLoading={creating} onClick={handleCreate}>{t('userMgmt.createUser')}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}

var SyncManagementTab = function() {
  const toast = useToast()
  const [syncPoints, setSyncPoints] = useState([])
  const [syncLogs, setSyncLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [logsLoading, setLogsLoading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editValues, setEditValues] = useState({})
  const [showLogs, setShowLogs] = useState(false)

  function fetchSyncPoints() {
    setLoading(true)
    adminAPI.listSyncPoints().then(function(data) {
      setSyncPoints(data.sync_points || [])
    }).catch(function() { setSyncPoints([]) }).finally(function() { setLoading(false) })
  }

  function fetchSyncLogs() {
    setLogsLoading(true)
    adminAPI.listSyncLogs(50).then(function(data) {
      setSyncLogs(data.logs || [])
    }).catch(function() { setSyncLogs([]) }).finally(function() { setLogsLoading(false) })
  }

  useEffect(fetchSyncPoints, [])

  useEffect(function() {
    if (showLogs) fetchSyncLogs()
  }, [showLogs])

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
        <HStack gap="8px">
          <Button h="28px" px="12px" fontSize="12px" rounded="6px"
            bg={showLogs ? '#22c55e' : 'transparent'} color={showLogs ? 'white' : '#666'}
            border="1px solid" borderColor={showLogs ? '#22c55e' : '#d1d5db'}
            _hover={{ borderColor: '#22c55e', color: showLogs ? 'white' : '#16a34a' }}
            leftIcon={<FileText size={13} />}
            onClick={function() { setShowLogs(!showLogs) }}>
            {t('admin.executionLogs')}
          </Button>
          <Button h="28px" px="12px" fontSize="12px" rounded="6px" variant="outline"
            borderColor="#d1d5db" color="#666" _hover={{ borderColor: '#22c55e', color: '#16a34a' }}
            leftIcon={<RefreshCw size={13} />}
            onClick={function() { fetchSyncPoints(); if (showLogs) fetchSyncLogs() }}>
            {t('common.refresh')}
          </Button>
        </HStack>
      </Flex>

      {showLogs && (
        <Box mb="20px">
          <HStack gap="6px" mb="12px">
            <FileText size={15} color="#555" />
            <Text fontSize="14px" fontWeight={600} color="#333">{t('admin.executionLogs')}</Text>
            <Text fontSize="12px" color="#aaa">({syncLogs.length})</Text>
          </HStack>
          {logsLoading ? (
            <Box display="flex" justifyContent="center" py="30px">
              <Spinner size="md" color="#22c55e" />
            </Box>
          ) : syncLogs.length === 0 ? (
            <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="30px" textAlign="center">
              <Text fontSize="14px" color="#aaa">{t('admin.noLogs')}</Text>
            </Box>
          ) : (
            <Box overflowX="auto">
              <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '10px', border: '1px solid #e2e2e2' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f0f0f0', fontSize: '12px', color: '#888', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 500 }}>{t('admin.projectCol')}</th>
                    <th style={{ padding: '10px 14px', fontWeight: 500 }}>{t('admin.typeCol')}</th>
                    <th style={{ padding: '10px 14px', fontWeight: 500 }}>{t('admin.statusCol')}</th>
                    <th style={{ padding: '10px 14px', fontWeight: 500 }}>{t('admin.durationCol')}</th>
                    <th style={{ padding: '10px 14px', fontWeight: 500 }}>{t('admin.messageCol')}</th>
                    <th style={{ padding: '10px 14px', fontWeight: 500 }}>{t('admin.timeCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {syncLogs.map(function(log) {
                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid #f0f0f0', fontSize: '13px' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <Text fontWeight={500} color="#333" fontSize="13px">{log.owner_name}/{log.repo_name}</Text>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <Badge fontSize="10px" px="6px" py="1px" rounded="4px"
                            bg={log.sync_type === 'mirror' ? '#dbeafe' : '#fef3c7'}
                            color={log.sync_type === 'mirror' ? '#2563eb' : '#d97706'}>
                            {log.sync_type === 'mirror' ? t('admin.mirrorSync') : t('admin.statsRefresh')}
                          </Badge>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {log.status === 'success' ? (
                            <HStack gap="4px" color="#16a34a">
                              <CheckCircle size={14} />
                              <Text fontSize="12px" fontWeight={500}>{t('admin.success')}</Text>
                            </HStack>
                          ) : (
                            <HStack gap="4px" color="#dc2626">
                              <XCircle size={14} />
                              <Text fontSize="12px" fontWeight={500}>{t('admin.failure')}</Text>
                            </HStack>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <HStack gap="4px" color="#888">
                            <Timer size={12} />
                            <Text fontSize="12px">{log.duration > 0 ? (log.duration < 1000 ? log.duration + 'ms' : (log.duration / 1000).toFixed(1) + 's') : '-'}</Text>
                          </HStack>
                        </td>
                        <td style={{ padding: '10px 14px', maxWidth: '260px' }}>
                          <Text fontSize="12px" color={log.status === 'failure' ? '#dc2626' : '#888'} noOfLines={1}>{log.message || '-'}</Text>
                        </td>
                        <td style={{ padding: '10px 14px', color: '#888', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          {formatDateTime(log.created_at)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Box>
          )}
        </Box>
      )}

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
