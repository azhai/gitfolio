import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Box, Text, Flex, VStack, HStack, Badge, Spinner, Button } from '@chakra-ui/react'
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
        ‹
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
        ›
      </Button>
    </Flex>
  )
}

const ProjectCommits = () => {
  const { owner, repo } = useParams()
  const navigate = useNavigate()
  const [commits, setCommits] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [showGraph, setShowGraph] = useState(true)

  useEffect(() => {
    setLoading(true)
    reposAPI.commits(owner, repo, { all: showGraph ? 'true' : 'false', page: page, per_page: 30 }).then(function(data) {
      var list = Array.isArray(data && data.commits ? data.commits : data) ? (data.commits || data) : []
      setCommits(list)
      setTotal(data && data.total ? data.total : 0)
    }).catch(function() { setCommits([]) }).finally(function() { setLoading(false) })
  }, [owner, repo, page, showGraph])

  var graphLayout = useMemo(function() {
    if (!showGraph || commits.length === 0) return null
    return computeGraphLayout(commits)
  }, [commits, showGraph])

  var graphSVG = useMemo(function() {
    if (!graphLayout) return null
    return renderFullGraph(graphLayout, commits)
  }, [graphLayout, commits])

  var graphWidth = graphLayout ? Math.max(graphLayout.laneCount, 1) * 18 + 8 : 0

  var totalPages = Math.ceil(total / 30) || 1

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
        <HStack gap="12px" fontSize="14px" fontWeight="600">
          <Text color="#333">📝 {t('projectCommits.title')}</Text>
          <Text color="#888" fontSize="13px">{t('projectCommits.total', { count: total })}</Text>
        </HStack>
        <HStack gap="10px">
          <Button h="28px" px="12px" fontSize="12px" rounded="6px"
            variant={showGraph ? 'solid' : 'outline'}
            bg={showGraph ? '#22c55e' : 'transparent'}
            color={showGraph ? 'white' : '#666'}
            borderColor="#d1d5db"
            _hover={showGraph ? { bg: '#16a34a' } : { bg: '#f9fafb' }}
            onClick={function() { setShowGraph(!showGraph); setPage(1) }}>
            {showGraph ? '📊 ' + t('projectCommits.hideGraph') : '📊 ' + t('projectCommits.showGraph')}
          </Button>
        </HStack>
      </Flex>

      <Box position="relative" border="1px solid" borderColor="#e2e2e2" rounded="10px" overflow="hidden">
        {showGraph && graphSVG && (
          <Box position="absolute" left="0" top="0" bg="#fafbfc" borderRight="1px solid" borderColor="#f0f0f0" zIndex={1}>
            {graphSVG}
          </Box>
        )}

        <Box ml={showGraph && graphLayout ? (graphWidth + 'px') : '0'}>
          {commits.map(function(commit, idx) {
            var hash = commit.hash || commit.sha || commit.id || ''
            var message = commit.message || commit.subject || ''
            var author = commit.author || commit.author_name || ''
            var time = commit.date || commit.time || commit.created_at || ''
            var branches = commit.branches || []
            var firstLine = message.split('\n')[0]

            return (
              <Flex
                key={hash || idx}
                align="center"
                h={ROW_H + 'px'}
                borderBottom={idx < commits.length - 1 ? '1px solid' : 'none'}
                borderColor="#f0f0f0"
                _hover={{ bg: '#f9faffb' }}
                cursor="pointer"
                px="12px"
                onClick={function() { navigate('/' + owner + '/' + repo + '/commits/' + hash) }}
                transition="background-color 0.15s"
              >
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
    </Box>
  )
}

export default ProjectCommits
