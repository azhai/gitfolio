import React, { useState, useEffect } from 'react'
import { Box, Text, Flex, VStack, HStack, Badge, Spinner, SimpleGrid } from '@chakra-ui/react'
import { useParams } from 'react-router-dom'
import { reposAPI } from '../../api/index'
import { timeAgo } from '../../i18n/zh'

var LANG_COLORS = {
  Go: '#00ADD8', JavaScript: '#F7DF1E', TypeScript: '#3178C6',
  Python: '#3572A5', Ruby: '#701516', Java: '#b07219',
  Rust: '#DEA584', PHP: '#4F5D95', 'C++': '#f34b7d',
  C: '#555555', Shell: '#89e051', HTML: '#e34c26',
  CSS: '#563d7c', SQL: '#4479A1', Markdown: '#083FA1',
  YAML: '#CB171E', JSON: '#292929', Dockerfile: '#384d54',
}

const ProjectStats = () => {
  const { owner, repo } = useParams()
  const [stats, setStats] = useState(null)
  const [activity, setActivity] = useState([])
  const [langStats, setLangStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      reposAPI.codeStats(owner, repo).catch(function() { return null }),
      reposAPI.commitActivity(owner, repo, 30).catch(function() { return null }),
    ]).then(function([codeStats, activityData]) {
      if (codeStats) {
        var langs = []
        if (Array.isArray(codeStats)) {
          langs = codeStats
        } else if (codeStats && codeStats.languages) {
          langs = codeStats.languages
        }
        setLangStats(langs)
      }
      if (activityData) {
        setStats(activityData)
        setActivity(Array.isArray(activityData.activity || activityData) ? (activityData.activity || activityData) : [])
      }
    }).finally(function() { setLoading(false) })
  }, [owner, repo])

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="60px">
        <Spinner size="lg" color="#22c55e" />
      </Box>
    )
  }

  var totalLines = langStats.reduce(function(sum, l) { return sum + (l.lines || l.size || 0) }, 0)

  return (
    <Box>
      <Text fontSize="18px" fontWeight="700" color="#333" mb="20px">📊 项目统计</Text>

      {langStats.length > 0 && (
        <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px" mb="20px">
          <Text fontSize="15px" fontWeight="600" color="#333" mb="16px">语言分布</Text>

          <Flex h="12px" rounded="6px" overflow="hidden" mb="12px">
            {langStats.map(function(lang, idx) {
              var pct = totalLines > 0 ? ((lang.lines || lang.size || 0) / totalLines * 100) : 0
              return (
                <Box key={lang.name || lang.language || idx}
                  h="100%" flex={pct + '%'}
                  bg={LANG_COLORS[lang.name || lang.language] || '#959DA5'}
                  title={(lang.name || lang.language) + ': ' + pct.toFixed(1) + '%'} />
              )
            })}
          </Flex>

          <VStack spacing="8px" align="stretch">
            {langStats.map(function(lang, idx) {
              var name = lang.name || lang.language || 'Other'
              var lines = lang.lines || lang.size || 0
              var pct = totalLines > 0 ? (lines / totalLines * 100) : 0
              return (
                <Flex key={name} align="center" gap="10px" fontSize="13px">
                  <Box w="12px" h="12px" rounded="2px" bg={LANG_COLORS[name] || '#959DA5'} flexShrink={0} />
                  <Text fontWeight="500" color="#333" flex={1}>{name}</Text>
                  <Text color="#888">{lines.toLocaleString()} 行</Text>
                  <Text color="#aaa" w="50px" textAlign="right">{pct.toFixed(1)}%</Text>
                </Flex>
              )
            })}
          </VStack>
        </Box>
      )}

      {activity.length > 0 && (
        <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px" mb="20px">
          <Text fontSize="15px" fontWeight="600" color="#333" mb="16px">提交活动（近30天）</Text>

          <VStack spacing="6px" align="stretch">
            {activity.slice().reverse().slice(0, 14).map(function(a, idx) {
              var count = a.count || a.commits || 0
              var maxCount = Math.max.apply(null, activity.map(function(x) { return x.count || x.commits || 1 }))
              var barWidth = maxCount > 0 ? (count / maxCount * 100) : 0
              return (
                <Flex key={idx} align="center" gap="10px" fontSize="13px">
                  <Text color="#888" w="80px" flexShrink={0}>{(a.date || '').substring(5)}</Text>
                  <Box flex={1} h="20px" bg="#f3f4f6" rounded="4px" overflow="hidden">
                    <Box h="100%" w={barWidth + '%'} bg="#22c55e" rounded="4px" transition="width 0.3s" />
                  </Box>
                  <Text color="#333" fontWeight="500" w="40px" textAlign="right">{count}</Text>
                </Flex>
              )
            })}
          </VStack>
        </Box>
      )}

      {langStats.length === 0 && activity.length === 0 && (
        <Box textAlign="center" py="60px" color="#aaa">
          <Text fontSize="36px" mb="8px">📊</Text>
          <Text fontSize="14px">暂无统计数据</Text>
        </Box>
      )}
    </Box>
  )
}

export default ProjectStats
