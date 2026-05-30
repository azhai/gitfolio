import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Box, Text, Flex, HStack, Spinner, Button, Input, Select, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton, Menu, MenuButton, MenuList, MenuItem, useDisclosure, useToast } from '@chakra-ui/react'
import { useParams, useNavigate } from 'react-router-dom'
import { reposAPI } from '../../api/index'
import { t, timeAgo } from '../../i18n/index'

function shortHash(hash) {
  return hash ? hash.substring(0, 7) : ''
}

var LANE_COLORS = [
  '#e74c3c', '#2ecc71', '#3498db', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#e91e63',
  '#00bcd4', '#8bc34a', '#ff5722', '#607d8b',
  '#795548', '#cddc39', '#ff9800', '#673ab7',
]

var ROW_H = 32

function getLaneColor(laneIndex) {
  return LANE_COLORS[laneIndex % LANE_COLORS.length]
}

function computeGraphLayout(commits) {
  if (!commits || commits.length === 0) return null

  var commitLanes = {}
  var commitFlows = {}
  var maxLane = 0
  var activeLanes = []
  var hashToLane = {}
  var lanesAbove = []
  var lanesBelow = []

  function findLaneForHash(hash) {
    if (hash in hashToLane) return hashToLane[hash]
    return -1
  }

  function findAvailableLane() {
    for (var i = 0; i < activeLanes.length; i++) {
      if (activeLanes[i] === null) return i
    }
    activeLanes.push(null)
    if (activeLanes.length - 1 > maxLane) maxLane = activeLanes.length - 1
    return activeLanes.length - 1
  }

  function setLane(lane, hash) {
    while (activeLanes.length <= lane) {
      activeLanes.push(null)
      if (activeLanes.length - 1 > maxLane) maxLane = activeLanes.length - 1
    }
    if (hash in hashToLane && hashToLane[hash] !== lane) {
      var oldLane = hashToLane[hash]
      if (oldLane < activeLanes.length && activeLanes[oldLane] === hash) {
        activeLanes[oldLane] = null
      }
    }
    activeLanes[lane] = hash
    hashToLane[hash] = lane
  }

  function clearLane(lane) {
    if (lane < activeLanes.length && activeLanes[lane] !== null) {
      var oldHash = activeLanes[lane]
      if (hashToLane[oldHash] === lane) {
        delete hashToLane[oldHash]
      }
      activeLanes[lane] = null
    }
  }

  function snapshotActive() {
    var s = new Set()
    for (var i = 0; i < activeLanes.length; i++) {
      if (activeLanes[i] !== null) s.add(i)
    }
    return s
  }

  for (var i = 0; i < commits.length; i++) {
    lanesAbove[i] = snapshotActive()

    var commit = commits[i]
    var hash = commit.hash
    var parents = commit.parents || []

    var myLane = findLaneForHash(hash)
    if (myLane === -1) {
      myLane = findAvailableLane()
    }

    commitLanes[hash] = myLane

    var flows = []

    if (parents.length === 0) {
      clearLane(myLane)
      commitFlows[hash] = flows
      lanesBelow[i] = snapshotActive()
      continue
    }

    var firstParent = parents[0]
    setLane(myLane, firstParent)
    flows.push({ fromLane: myLane, toLane: myLane, type: 'straight' })

    for (var p = 1; p < parents.length; p++) {
      var parentHash = parents[p]
      var existingLane = findLaneForHash(parentHash)

      if (existingLane !== -1) {
        flows.push({ fromLane: myLane, toLane: existingLane, type: 'merge' })
      } else {
        var newLane = findAvailableLane()
        setLane(newLane, parentHash)
        flows.push({ fromLane: myLane, toLane: newLane, type: 'branch' })
      }
    }

    commitFlows[hash] = flows
    lanesBelow[i] = snapshotActive()
  }

  var laneCount = maxLane + 1
  var laneColorsMap = {}
  for (var l = 0; l < laneCount; l++) {
    laneColorsMap[l] = getLaneColor(l)
  }

  return { commitLanes: commitLanes, commitFlows: commitFlows, laneCount: laneCount, laneColors: laneColorsMap, lanesAbove: lanesAbove, lanesBelow: lanesBelow }
}

function renderFullGraph(layout, commits) {
  if (!layout || commits.length === 0) return null

  var commitLanes = layout.commitLanes
  var commitFlows = layout.commitFlows
  var laneCount = layout.laneCount
  var laneColors = layout.laneColors
  var lanesAbove = layout.lanesAbove
  var lanesBelow = layout.lanesBelow

  var LANE_W = 18
  var NODE_R = 3
  var LINE_W = 1.8
  var PAD_X = 4
  var totalWidth = Math.max(laneCount, 1) * LANE_W + PAD_X * 2
  var totalHeight = commits.length * ROW_H

  var allPaths = []
  var allCircles = []

  for (var idx = 0; idx < commits.length; idx++) {
    var commit = commits[idx]
    var hash = commit.hash
    var myLane = commitLanes[hash] || 0
    var myX = myLane * LANE_W + LANE_W / 2 + PAD_X
    var myY = idx * ROW_H + ROW_H / 2
    var color = laneColors[myLane]

    var above = lanesAbove[idx]
    var below = lanesBelow[idx]
    var rowTop = idx * ROW_H
    var rowBot = (idx + 1) * ROW_H

    if (above.has(myLane)) {
      allPaths.push({ d: 'M ' + myX + ' ' + rowTop + ' L ' + myX + ' ' + (myY - NODE_R), color: color })
    }

    var flows = commitFlows[hash] || []
    var flowTargetLanes = new Set()

    for (var fi = 0; fi < flows.length; fi++) {
      var flow = flows[fi]
      var toX = flow.toLane * LANE_W + LANE_W / 2 + PAD_X
      var toColor = laneColors[flow.toLane]
      flowTargetLanes.add(flow.toLane)

      if (flow.type === 'straight') {
        allPaths.push({ d: 'M ' + myX + ' ' + (myY + NODE_R) + ' L ' + myX + ' ' + rowBot, color: toColor })
      } else {
        var cp1y = myY + (rowBot - myY) * 0.4
        var cp2y = rowBot - (rowBot - myY) * 0.4
        allPaths.push({ d: 'M ' + myX + ' ' + (myY + NODE_R) + ' C ' + myX + ' ' + cp1y + ', ' + toX + ' ' + cp2y + ', ' + toX + ' ' + rowBot, color: toColor })
      }
    }

    var handledLanes = new Set([myLane])
    flowTargetLanes.forEach(function(l) { handledLanes.add(l) })

    above.forEach(function(lane) {
      if (handledLanes.has(lane)) return
      var lx = lane * LANE_W + LANE_W / 2 + PAD_X
      var lColor = laneColors[lane]

      if (below.has(lane)) {
        allPaths.push({ d: 'M ' + lx + ' ' + rowTop + ' L ' + lx + ' ' + rowBot, color: lColor })
      } else {
        allPaths.push({ d: 'M ' + lx + ' ' + rowTop + ' L ' + lx + ' ' + (myY - NODE_R), color: lColor })
        var cp1y2 = (myY - NODE_R) + (myY - (myY - NODE_R)) * 0.5
        allPaths.push({ d: 'M ' + lx + ' ' + (myY - NODE_R) + ' C ' + lx + ' ' + cp1y2 + ', ' + myX + ' ' + (myY - NODE_R - 2) + ', ' + myX + ' ' + (myY - NODE_R), color: lColor })
      }
    })

    allCircles.push({ cx: myX, cy: myY, r: NODE_R + 1, fill: '#1a1a2e' })
    allCircles.push({ cx: myX, cy: myY, r: NODE_R, fill: color, stroke: '#fff', strokeWidth: 1.2 })
  }

  return React.createElement('svg', {
    width: totalWidth, height: totalHeight,
    viewBox: '0 0 ' + totalWidth + ' ' + totalHeight,
    style: { display: 'block' },
  },
    allPaths.map(function(p, pi) {
      return React.createElement('path', {
        key: 'p' + pi, d: p.d,
        stroke: p.color, strokeWidth: LINE_W,
        fill: 'none', strokeLinecap: 'round',
      })
    }),
    allCircles.map(function(c, ci) {
      return React.createElement('circle', {
        key: 'c' + ci, cx: c.cx, cy: c.cy, r: c.r,
        fill: c.fill, stroke: c.stroke || 'none', strokeWidth: c.strokeWidth || 0,
      })
    })
  )
}

var PAGE_SIZE = 5

function PaginationBar(_ref) {
  var page = _ref.page
  var totalPages = _ref.totalPages
  var onPageChange = _ref.onPageChange

  if (totalPages <= 1) return null

  var start = Math.floor((page - 1) / PAGE_SIZE) * PAGE_SIZE + 1
  var end = Math.min(start + PAGE_SIZE - 1, totalPages)
  var pages = []
  for (var i = start; i <= end; i++) {
    pages.push(i)
  }

  return (
    <Flex justify="center" align="center" gap="6px" mt="16px">
      <Button h="28px" px="10px" fontSize="12px" rounded="6px"
        isDisabled={page <= 1}
        onClick={function() { onPageChange(page - 1) }}
        variant="outline" borderColor="#d1d5db">
        &lsaquo;
      </Button>
      {start > 1 && (
        <Button h="28px" px="10px" fontSize="12px" rounded="6px"
          variant="outline" borderColor="#d1d5db"
          onClick={function() { onPageChange(start - 1) }}>
          ...
        </Button>
      )}
      {pages.map(function(p) {
        return (
          <Button key={p} h="28px" px="12px" fontSize="12px" rounded="6px"
            bg={p === page ? '#22c55e' : 'transparent'}
            color={p === page ? 'white' : '#666'}
            variant={p === page ? 'solid' : 'outline'}
            borderColor={p === page ? '#22c55e' : '#d1d5db'}
            _hover={p === page ? { bg: '#16a34a' } : { bg: '#f9fafb' }}
            onClick={function() { onPageChange(p) }}>
            {p}
          </Button>
        )
      })}
      {end < totalPages && (
        <Button h="28px" px="10px" fontSize="12px" rounded="6px"
          variant="outline" borderColor="#d1d5db"
          onClick={function() { onPageChange(end + 1) }}>
          ...
        </Button>
      )}
      <Button h="28px" px="10px" fontSize="12px" rounded="6px"
        isDisabled={page >= totalPages}
        onClick={function() { onPageChange(page + 1) }}
        variant="outline" borderColor="#d1d5db">
        &rsaquo;
      </Button>
    </Flex>
  )
}

var ProjectCommits = function() {
  var params = useParams()
  var owner = params.owner
  var repo = params.repo
  var navigate = useNavigate()
  var toast = useToast()

  var _useState = useState([])
  var commits = _useState[0]
  var setCommits = _useState[1]

  var _useState2 = useState(true)
  var loading = _useState2[0]
  var setLoading = _useState2[1]

  var _useState3 = useState(1)
  var page = _useState3[0]
  var setPage = _useState3[1]

  var _useState4 = useState(0)
  var total = _useState4[0]
  var setTotal = _useState4[1]

  var _useState6 = useState('__all__')
  var selectedBranch = _useState6[0]
  var setSelectedBranch = _useState6[1]

  var _useState7 = useState([])
  var branches = _useState7[0]
  var setBranches = _useState7[1]

  var _useState8 = useState([])
  var tags = _useState8[0]
  var setTags = _useState8[1]

  var _useState9 = useState(null)
  var repoInfo = _useState9[0]
  var setRepoInfo = _useState9[1]

  var _useState10 = useState(false)
  var pulling = _useState10[0]
  var setPulling = _useState10[1]

  // Commit operation mode: null / 'revert' / 'reset' / 'rebase'
  var _useState11 = useState(null)
  var opMode = _useState11[0]
  var setOpMode = _useState11[1]

  var _useState12 = useState(null)
  var selectFrom = _useState12[0]
  var setSelectFrom = _useState12[1]

  var _useState13 = useState(null)
  var selectTo = _useState13[0]
  var setSelectTo = _useState13[1]

  var _useState14 = useState(false)
  var operating = _useState14[0]
  var setOperating = _useState14[1]

  // Reset count
  var _useState20 = useState(1)
  var resetCount = _useState20[0]
  var setResetCount = _useState20[1]

  // Conflict state
  var _useState21 = useState(null)
  var conflictInfo = _useState21[0]
  var setConflictInfo = _useState21[1]

  // Tag modal
  var tagModal = useDisclosure()
  var _useState15 = useState('')
  var newTagName = _useState15[0]
  var setNewTagName = _useState15[1]

  var _useState16 = useState('')
  var newTagBranch = _useState16[0]
  var setNewTagBranch = _useState16[1]

  var _useState17 = useState(false)
  var creatingTag = _useState17[0]
  var setCreatingTag = _useState17[1]

  // Default branch modal
  var branchModal = useDisclosure()
  var _useState18 = useState('')
  var defaultBranchInput = _useState18[0]
  var setDefaultBranchInput = _useState18[1]

  var _useState19 = useState(false)
  var settingBranch = _useState19[0]
  var setSettingBranch = _useState19[1]

  var hasLocalPath = repoInfo && repoInfo.local_path

  // Check git status for conflicts on mount
  useEffect(function() {
    if (!hasLocalPath) return
    reposAPI.getGitStatus(owner, repo).then(function(data) {
      if (data.rebasing || data.reverting || data.merging) {
        var opType = data.rebasing ? 'rebase' : data.reverting ? 'revert' : 'merge'
        setConflictInfo({ type: opType, active: true })
      }
    }).catch(function() {})
  }, [owner, repo, hasLocalPath])

  // Load repo info
  useEffect(function() {
    reposAPI.get(owner, repo).then(function(data) {
      setRepoInfo(data)
    }).catch(function() {})
  }, [owner, repo])

  // Load branches and tags
  useEffect(function() {
    reposAPI.branches(owner, repo).then(function(data) {
      var list = data.branches || []
      setBranches(list)
    }).catch(function() { setBranches([]) })

    reposAPI.tags(owner, repo).then(function(data) {
      setTags(data.tags || [])
    }).catch(function() { setTags([]) })
  }, [owner, repo])

  // Load commits
  useEffect(function() {
    setLoading(true)
    var params = { page: page, per_page: 30 }
    if (selectedBranch && selectedBranch !== '__all__') {
      params.ref = selectedBranch
      params.all = 'false'
    } else {
      params.all = 'true'
    }
    reposAPI.commits(owner, repo, params).then(function(data) {
      var list = Array.isArray(data && data.commits ? data.commits : data) ? (data.commits || data) : []
      setCommits(list)
      setTotal(data && data.total ? data.total : 0)
    }).catch(function() { setCommits([]) }).finally(function() { setLoading(false) })
  }, [owner, repo, page, selectedBranch])

  // Reset operation mode when branch changes
  useEffect(function() {
    setOpMode(null)
    setSelectFrom(null)
    setSelectTo(null)
  }, [selectedBranch])

  var graphLayout = useMemo(function() {
    if (selectedBranch !== '__all__' || commits.length === 0) return null
    return computeGraphLayout(commits)
  }, [commits, selectedBranch])

  var graphSVG = useMemo(function() {
    if (!graphLayout) return null
    return renderFullGraph(graphLayout, commits)
  }, [graphLayout, commits])

  var graphWidth = graphLayout ? Math.max(graphLayout.laneCount, 1) * 18 + 8 : 0
  var totalPages = Math.ceil(total / 30) || 1

  var handlePull = useCallback(function() {
    setPulling(true)
    reposAPI.syncPull(owner, repo).then(function() {
      toast({ title: t('projectSettings.pullCodeStarted'), status: 'success', duration: 3000 })
    }).catch(function(err) {
      toast({ title: err.message || t('projectSettings.syncFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setPulling(false) })
  }, [owner, repo, toast])

  var handleCreateTag = useCallback(function() {
    if (!newTagName.trim()) return
    setCreatingTag(true)
    reposAPI.createTag(owner, repo, newTagName.trim(), newTagBranch || (repoInfo && repoInfo.default_branch) || 'main').then(function() {
      toast({ title: 'Tag created: ' + newTagName, status: 'success', duration: 3000 })
      setNewTagName('')
      setNewTagBranch('')
      tagModal.onClose()
      return reposAPI.tags(owner, repo)
    }).then(function(data) {
      setTags(data.tags || [])
    }).catch(function(err) {
      toast({ title: err.message || 'Failed to create tag', status: 'error', duration: 3000 })
    }).finally(function() { setCreatingTag(false) })
  }, [owner, repo, newTagName, newTagBranch, repoInfo, tagModal, toast])

  var handleDeleteTag = useCallback(function(tagName) {
    if (!confirm('Delete tag "' + tagName + '"?')) return
    reposAPI.deleteTag(owner, repo, tagName).then(function() {
      toast({ title: 'Tag deleted: ' + tagName, status: 'success', duration: 3000 })
      return reposAPI.tags(owner, repo)
    }).then(function(data) {
      setTags(data.tags || [])
    }).catch(function(err) {
      toast({ title: err.message || 'Failed to delete tag', status: 'error', duration: 3000 })
    })
  }, [owner, repo, toast])

  var handleSetDefaultBranch = useCallback(function() {
    if (!defaultBranchInput.trim()) return
    setSettingBranch(true)
    reposAPI.setDefaultBranch(owner, repo, defaultBranchInput.trim()).then(function() {
      toast({ title: 'Default branch set to: ' + defaultBranchInput, status: 'success', duration: 3000 })
      setSelectedBranch(defaultBranchInput.trim())
      setRepoInfo(function(prev) { return prev ? Object.assign({}, prev, { default_branch: defaultBranchInput.trim() }) : prev })
      branchModal.onClose()
    }).catch(function(err) {
      toast({ title: err.message || 'Failed to set default branch', status: 'error', duration: 3000 })
    }).finally(function() { setSettingBranch(false) })
  }, [owner, repo, defaultBranchInput, branchModal, toast])

  var handleDeleteCommits = useCallback(function() {
    if (!selectFrom || !selectTo) return
    if (!confirm(t('projectCommits.confirmRebase', { from: shortHash(selectFrom), to: shortHash(selectTo) }))) return
    setOperating(true)
    reposAPI.deleteCommitRange(owner, repo, selectFrom, selectTo).then(function() {
      toast({ title: t('projectCommits.rebaseSuccess'), status: 'success', duration: 3000 })
      setOpMode(null)
      setSelectFrom(null)
      setSelectTo(null)
      setPage(1)
    }).catch(function(err) {
      var msg = err.message || t('projectCommits.operationFailed')
      if (msg.indexOf('CONFLICT') !== -1) {
        setConflictInfo({ type: 'rebase', active: true, message: msg })
      }
      toast({ title: msg, status: 'error', duration: 5000 })
    }).finally(function() { setOperating(false) })
  }, [owner, repo, selectFrom, selectTo, toast])

  var handleRevertCommit = useCallback(function(sha) {
    if (!confirm(t('projectCommits.confirmRevert', { sha: shortHash(sha) }))) return
    setOperating(true)
    reposAPI.revertCommit(owner, repo, sha).then(function() {
      toast({ title: t('projectCommits.revertSuccess'), status: 'success', duration: 3000 })
      setOpMode(null)
      setPage(1)
    }).catch(function(err) {
      var msg = err.message || t('projectCommits.operationFailed')
      if (msg.indexOf('CONFLICT') !== -1) {
        setConflictInfo({ type: 'revert', active: true, message: msg })
      }
      toast({ title: msg, status: 'error', duration: 5000 })
    }).finally(function() { setOperating(false) })
  }, [owner, repo, toast])

  var handleResetCommits = useCallback(function() {
    if (resetCount <= 0) return
    if (!confirm(t('projectCommits.confirmReset', { count: resetCount }))) return
    setOperating(true)
    reposAPI.resetCommits(owner, repo, resetCount).then(function() {
      toast({ title: t('projectCommits.resetSuccess'), status: 'success', duration: 3000 })
      setOpMode(null)
      setResetCount(1)
      setPage(1)
    }).catch(function(err) {
      toast({ title: err.message || t('projectCommits.operationFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setOperating(false) })
  }, [owner, repo, resetCount, toast])

  var handleAbort = useCallback(function() {
    if (!conflictInfo) return
    setOperating(true)
    reposAPI.abortOperation(owner, repo, conflictInfo.type).then(function() {
      toast({ title: t('projectCommits.abortSuccess'), status: 'success', duration: 3000 })
      setConflictInfo(null)
      setPage(1)
    }).catch(function(err) {
      toast({ title: err.message || t('projectCommits.operationFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setOperating(false) })
  }, [owner, repo, conflictInfo, toast])

  var handleCommitClick = useCallback(function(hash) {
    // 全部分支模式下直接导航到详情
    if (selectedBranch === '__all__') {
      navigate('/' + owner + '/' + repo + '/commits/' + hash)
      return
    }
    if (opMode === 'revert') {
      handleRevertCommit(hash)
      return
    }
    if (opMode === 'rebase') {
      if (!selectFrom) {
        setSelectFrom(hash)
      } else if (!selectTo) {
        var fromIdx = commits.findIndex(function(c) { return (c.hash || c.sha || c.id) === selectFrom })
        var toIdx = commits.findIndex(function(c) { return (c.hash || c.sha || c.id) === hash })
        if (fromIdx <= toIdx) {
          setSelectTo(hash)
        } else {
          setSelectTo(selectFrom)
          setSelectFrom(hash)
        }
      } else {
        setSelectFrom(hash)
        setSelectTo(null)
      }
      return
    }
    navigate('/' + owner + '/' + repo + '/commits/' + hash)
  }, [selectedBranch, opMode, selectFrom, selectTo, commits, owner, repo, navigate, handleRevertCommit])

  var isSelected = useCallback(function(hash) {
    return hash === selectFrom || hash === selectTo
  }, [selectFrom, selectTo])

  var isInSelectedRange = useCallback(function(hash) {
    if (!selectFrom || !selectTo) return false
    var fromIdx = commits.findIndex(function(c) { return (c.hash || c.sha || c.id) === selectFrom })
    var toIdx = commits.findIndex(function(c) { return (c.hash || c.sha || c.id) === selectTo })
    var idx = commits.findIndex(function(c) { return (c.hash || c.sha || c.id) === hash })
    return idx >= fromIdx && idx <= toIdx
  }, [selectFrom, selectTo, commits])

  if (loading && commits.length === 0) {
    return (
      <Box display="flex" justifyContent="center" py="60px">
        <Spinner size="lg" color="#22c55e" />
      </Box>
    )
  }

  return (
    <Box>
      {/* Toolbar */}
      <Flex justify="space-between" align="center" mb="12px" flexWrap="wrap" gap="8px">
        <HStack gap="12px" fontSize="14px" fontWeight="600">
          <Text color="#333">{t('projectCommits.title')}</Text>
          <Text color="#888" fontSize="13px">{t('projectCommits.total', { count: total })}</Text>
        </HStack>
        <HStack gap="8px" flexWrap="wrap">
          {hasLocalPath && selectedBranch !== '__all__' && !conflictInfo && (
            <Menu>
              <MenuButton h="28px" px="12px" fontSize="12px" rounded="6px"
                as={Button} variant="outline" borderColor="#ef4444" color="#ef4444"
                _hover={{ bg: '#fef2f2' }}
                isActive={!!opMode}>
                {opMode ? t('projectCommits.cancelOp') : t('projectCommits.commitOps')}
              </MenuButton>
              <MenuList minW="140px" fontSize="12px">
                <MenuItem onClick={function() { setOpMode(opMode === 'revert' ? null : 'revert'); setSelectFrom(null); setSelectTo(null) }}
                  bg={opMode === 'revert' ? '#fef2f2' : undefined}
                  fontWeight={opMode === 'revert' ? '600' : '400'}>
                  {opMode === 'revert' ? '✓ ' : ''}{t('projectCommits.revert')}
                </MenuItem>
                <MenuItem onClick={function() { setOpMode(opMode === 'reset' ? null : 'reset'); setSelectFrom(null); setSelectTo(null) }}
                  bg={opMode === 'reset' ? '#fef2f2' : undefined}
                  fontWeight={opMode === 'reset' ? '600' : '400'}>
                  {opMode === 'reset' ? '✓ ' : ''}{t('projectCommits.reset')}
                </MenuItem>
                <MenuItem onClick={function() { setOpMode(opMode === 'rebase' ? null : 'rebase'); setSelectFrom(null); setSelectTo(null) }}
                  bg={opMode === 'rebase' ? '#fef2f2' : undefined}
                  fontWeight={opMode === 'rebase' ? '600' : '400'}>
                  {opMode === 'rebase' ? '✓ ' : ''}{t('projectCommits.rebase')}
                </MenuItem>
              </MenuList>
            </Menu>
          )}
          {hasLocalPath && opMode && (
            <Button h="28px" px="10px" fontSize="11px" rounded="6px"
              variant="outline" borderColor="#aaa" color="#666"
              _hover={{ bg: '#f5f5f5' }}
              onClick={function() { setOpMode(null); setSelectFrom(null); setSelectTo(null); setResetCount(1) }}>
              {t('projectCommits.cancelOp')}
            </Button>
          )}
        </HStack>
      </Flex>

      {/* Branch selector + Tag management + Default branch */}
      <Flex mb="12px" gap="8px" align="center" flexWrap="wrap">
        <Select h="30px" fontSize="12px" w="180px" borderRadius="6px"
          value={selectedBranch}
          onChange={function(e) { setSelectedBranch(e.target.value); setPage(1) }}>
          <option value="__all__">{t('projectCommits.allBranches')}</option>
          {branches.map(function(b) {
            var name = b.replace(/^remotes\/origin\//, '')
            return <option key={b} value={name}>{name}{repoInfo && repoInfo.default_branch === name ? ' (' + t('projectBranches.default') + ')' : ''}</option>
          })}
        </Select>

        {hasLocalPath && (
          <Button h="28px" px="12px" fontSize="12px" rounded="6px"
            variant="outline" borderColor="#22c55e" color="#16a34a"
            _hover={{ bg: '#f0fdf4' }}
            onClick={handlePull} isLoading={pulling}>
            {t('projectSettings.pullCode')}
          </Button>
        )}

        {hasLocalPath && (
          <Button h="28px" px="12px" fontSize="12px" rounded="6px"
            variant="outline" borderColor="#d1d5db" color="#555"
            _hover={{ bg: '#f9fafb' }}
            onClick={function() {
              setDefaultBranchInput((repoInfo && repoInfo.default_branch) || 'main')
              branchModal.onOpen()
            }}>
            {t('projectCommits.setDefaultBranch')}
          </Button>
        )}

        {hasLocalPath && (
          <Button h="28px" px="12px" fontSize="12px" rounded="6px"
            variant="outline" borderColor="#8b5cf6" color="#7c3aed"
            _hover={{ bg: '#f5f3ff' }}
            onClick={function() {
              setNewTagName('')
              setNewTagBranch(selectedBranch !== '__all__' ? selectedBranch : (repoInfo && repoInfo.default_branch) || 'main')
              tagModal.onOpen()
            }}>
            {t('projectCommits.createTag')}
          </Button>
        )}

        {tags.length > 0 && (
          <HStack gap="4px" flexWrap="wrap">
            {tags.slice(0, 5).map(function(tag) {
              return (
                <HStack key={tag} spacing="2px" bg="#f5f3ff" px="6px" py="2px" rounded="4px" fontSize="11px">
                  <Text color="#7c3aed" fontWeight="500">{tag}</Text>
                  {hasLocalPath && (
                    <Text color="#aaa" cursor="pointer" _hover={{ color: '#ef4444' }}
                      onClick={function() { handleDeleteTag(tag) }}>x</Text>
                  )}
                </HStack>
              )
            })}
            {tags.length > 5 && (
              <Text fontSize="11px" color="#999">+{tags.length - 5}</Text>
            )}
          </HStack>
        )}
      </Flex>

      {/* Conflict warning bar */}
      {conflictInfo && conflictInfo.active && (
        <Flex mb="8px" p="8px 12px" bg="#fef2f2" rounded="6px" align="center" gap="8px" borderLeft="3px solid #ef4444">
          <Text fontSize="12px" color="#991b1b" flex="1">
            {t('projectCommits.conflictDetected', { type: conflictInfo.type })}
          </Text>
          <Button h="26px" px="10px" fontSize="11px" rounded="4px"
            bg="#ef4444" color="white" _hover={{ bg: '#dc2626' }}
            onClick={handleAbort} isLoading={operating}>
            {t('projectCommits.abortOp')}
          </Button>
        </Flex>
      )}

      {/* Operation action bar */}
      {opMode === 'revert' && (
        <Flex mb="8px" p="8px 12px" bg="#fffbeb" rounded="6px" align="center" gap="8px">
          <Text fontSize="12px" color="#92400e">
            {t('projectCommits.revertHint')}
          </Text>
        </Flex>
      )}

      {opMode === 'reset' && (
        <Flex mb="8px" p="8px 12px" bg="#fffbeb" rounded="6px" align="center" gap="8px">
          <Text fontSize="12px" color="#92400e" mr="8px">
            {t('projectCommits.resetHint')}
          </Text>
          <Input type="number" min="1" max="99" value={resetCount}
            onChange={function(e) { setResetCount(Math.max(1, parseInt(e.target.value) || 1)) }}
            w="60px" h="26px" fontSize="12px" textAlign="center" borderRadius="4px" />
          <Button h="26px" px="10px" fontSize="11px" rounded="4px"
            bg="#ef4444" color="white" _hover={{ bg: '#dc2626' }}
            onClick={handleResetCommits} isLoading={operating}>
            {t('projectCommits.confirmResetBtn')}
          </Button>
        </Flex>
      )}

      {opMode === 'rebase' && selectFrom && (
        <Flex mb="8px" p="8px 12px" bg="#fef2f2" rounded="6px" align="center" gap="8px">
          <Text fontSize="12px" color="#991b1b">
            {selectTo
              ? t('projectCommits.selectedRange', { from: shortHash(selectFrom), to: shortHash(selectTo) })
              : t('projectCommits.selectTo', { from: shortHash(selectFrom) })}
          </Text>
          {selectFrom && selectTo && (
            <Button h="26px" px="10px" fontSize="11px" rounded="4px"
              bg="#ef4444" color="white" _hover={{ bg: '#dc2626' }}
              onClick={handleDeleteCommits} isLoading={operating}>
              {t('projectCommits.confirmDelete')}
            </Button>
          )}
        </Flex>
      )}

      {/* Commit list */}
      <Box position="relative" border="1px solid" borderColor="#e2e2e2" rounded="10px" overflow="hidden">
        {selectedBranch === '__all__' && graphSVG && (
          <Box position="absolute" left="0" top="0" bg="#fafbfc" borderRight="1px solid" borderColor="#f0f0f0" zIndex={1}>
            {graphSVG}
          </Box>
        )}

        <Box ml={selectedBranch === '__all__' && graphLayout ? (graphWidth + 'px') : '0'}>
          {commits.map(function(commit, idx) {
            var hash = commit.hash || commit.sha || commit.id || ''
            var message = commit.message || commit.subject || ''
            var author = commit.author || commit.author_name || ''
            var time = commit.date || commit.time || commit.created_at || ''
            var firstLine = message.split('\n')[0]
            var selected = isSelected(hash)
            var inRange = isInSelectedRange(hash)

            return (
              <Flex
                key={hash || idx}
                align="center"
                h={ROW_H + 'px'}
                borderBottom={idx < commits.length - 1 ? '1px solid' : 'none'}
                borderColor="#f0f0f0"
                bg={selected ? '#fef2f2' : inRange ? '#fefce8' : 'transparent'}
                _hover={{ bg: selected ? '#fee2e2' : inRange ? '#fef9c3' : '#f9faffb' }}
                cursor="pointer"
                px="12px"
                onClick={function() { handleCommitClick(hash) }}
                transition="background-color 0.15s"
              >
                {selectedBranch !== '__all__' && opMode && (
                  <Box w="16px" h="16px" mr="8px" borderRadius="4px"
                    border="2px solid" borderColor={selected ? '#ef4444' : inRange ? '#f59e0b' : '#d1d5db'}
                    bg={selected ? '#ef4444' : inRange ? '#f59e0b' : 'transparent'}
                    flexShrink={0}
                  />
                )}
                <Text fontSize="13px" fontWeight="500" color="#333" noOfLines={1} flex="1" pr="8px">
                  {firstLine}
                </Text>
                <Text fontSize="12px" color="#888" flexShrink={0} mr="12px" w="60px" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                  {author}
                </Text>
                <Text fontSize="11px" color="#aaa" flexShrink={0} mr="12px" w="70px" textAlign="right">
                  {timeAgo(time)}
                </Text>
                <Text fontSize="12px" fontFamily="monospace" color="#16a34a" flexShrink={0}
                  bg="#f0fdf4" px="6px" py="1px" rounded="4px" _hover={{ bg: '#dcfce7' }}>
                  {commit.short_hash || shortHash(hash)}
                </Text>
              </Flex>
            )
          })}
        </Box>
      </Box>

      <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />

      {!loading && commits.length === 0 && (
        <Box textAlign="center" py="50px" color="#aaa">
          <Text fontSize="36px" mb="6px">📝</Text>
          <Text fontSize="14px">{t('projectCommits.noCommits')}</Text>
        </Box>
      )}

      {/* Create Tag Modal */}
      <Modal isOpen={tagModal.isOpen} onClose={tagModal.onClose} isCentered>
        <ModalOverlay />
        <ModalContent mx="16px">
          <ModalHeader fontSize="15px">{t('projectCommits.createTag')}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb="20px">
            <Box mb="12px">
              <Text fontSize="12px" color="#666" mb="4px">{t('projectCommits.tagName')}</Text>
              <Input value={newTagName} onChange={function(e) { setNewTagName(e.target.value) }}
                placeholder="v1.0.0" h="36px" fontSize="14px" borderRadius="6px" />
            </Box>
            <Box mb="12px">
              <Text fontSize="12px" color="#666" mb="4px">{t('projectCommits.tagBranch')}</Text>
              <Select value={newTagBranch} onChange={function(e) { setNewTagBranch(e.target.value) }}
                h="36px" fontSize="14px" borderRadius="6px">
                {branches.map(function(b) {
                  var name = b.replace(/^remotes\/origin\//, '')
                  return <option key={b} value={name}>{name}</option>
                })}
              </Select>
            </Box>
            <Button w="100%" h="36px" fontSize="13px" rounded="6px"
              bg="#8b5cf6" color="white" _hover={{ bg: '#7c3aed' }}
              onClick={handleCreateTag} isLoading={creatingTag}
              isDisabled={!newTagName.trim()}>
              {t('projectCommits.createTag')}
            </Button>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Set Default Branch Modal */}
      <Modal isOpen={branchModal.isOpen} onClose={branchModal.onClose} isCentered>
        <ModalOverlay />
        <ModalContent mx="16px">
          <ModalHeader fontSize="15px">{t('projectCommits.setDefaultBranch')}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb="20px">
            <Box mb="12px">
              <Text fontSize="12px" color="#666" mb="4px">{t('projectCommits.defaultBranchName')}</Text>
              <Select value={defaultBranchInput} onChange={function(e) { setDefaultBranchInput(e.target.value) }}
                h="36px" fontSize="14px" borderRadius="6px">
                {branches.map(function(b) {
                  var name = b.replace(/^remotes\/origin\//, '')
                  return <option key={b} value={name}>{name}</option>
                })}
              </Select>
            </Box>
            <Button w="100%" h="36px" fontSize="13px" rounded="6px"
              bg="#22c55e" color="white" _hover={{ bg: '#16a34a' }}
              onClick={handleSetDefaultBranch} isLoading={settingBranch}>
              {t('projectCommits.setDefaultBranch')}
            </Button>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  )
}

export default ProjectCommits
