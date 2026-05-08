import React, { useMemo } from 'react'
import { Box, Text } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function renderInline(text, owner, repo) {
  if (!text) return ''
  var html = escapeHtml(text)

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/`([^`]+?)`/g, '<code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:0.9em">$1</code>')
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#22c55e;text-decoration:underline">$1</a>')

  if (owner && repo) {
    html = html.replace(/#(\d+)/g, function(match, num) {
      return '<a href="/' + owner + '/' + repo + '/issues/' + num + '" style="color:#2563eb;text-decoration:none;font-weight:500">#' + num + '</a>'
    })
  }

  return html
}

function renderContent(source, owner, repo) {
  if (!source) return []
  var lines = source.split('\n')
  var blocks = []
  var currentList = []
  var inCodeBlock = false
  var codeLines = []

  function flushList() {
    if (currentList.length > 0) {
      blocks.push({ type: 'list', items: currentList })
      currentList = []
    }
  }

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i]

    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        blocks.push({ type: 'code', content: codeLines.join('\n') })
        codeLines = []
        inCodeBlock = false
      } else {
        flushList()
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeLines.push(line)
      continue
    }

    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      currentList.push(renderInline(line.trim().substring(2), owner, repo))
      continue
    }

    flushList()

    if (line.trim() === '') {
      blocks.push({ type: 'blank' })
    } else if (line.trim().startsWith('### ')) {
      blocks.push({ type: 'h3', content: renderInline(line.trim().substring(4), owner, repo) })
    } else if (line.trim().startsWith('## ')) {
      blocks.push({ type: 'h2', content: renderInline(line.trim().substring(3), owner, repo) })
    } else if (line.trim().startsWith('# ')) {
      blocks.push({ type: 'h1', content: renderInline(line.trim().substring(2), owner, repo) })
    } else if (line.trim().startsWith('> ')) {
      blocks.push({ type: 'quote', content: renderInline(line.trim().substring(2), owner, repo) })
    } else if (line.trim() === '---') {
      blocks.push({ type: 'hr' })
    } else {
      blocks.push({ type: 'p', content: renderInline(line, owner, repo) })
    }
  }

  flushList()
  if (inCodeBlock && codeLines.length > 0) {
    blocks.push({ type: 'code', content: codeLines.join('\n') })
  }

  return blocks
}

var SimpleRenderer = function(props) {
  var { source, fontSize, owner, repo } = props
  fontSize = fontSize || '14px'

  var blocks = useMemo(function() {
    return renderContent(source, owner, repo)
  }, [source, owner, repo])

  if (!source) return null

  return (
    <Box sx={{
      fontSize: fontSize,
      lineHeight: '1.7',
      color: '#333',
      wordBreak: 'break-word',
      '& strong': { fontWeight: '600' },
      '& em': { fontStyle: 'italic' },
      '& a': { color: '#22c55e', textDecoration: 'underline', _hover: { color: '#16a34a' } },
    }}>
      {blocks.map(function(block, idx) {
        if (block.type === 'p') {
          return <Box key={idx} mb="8px" dangerouslySetInnerHTML={{ __html: block.content }} />
        }
        if (block.type === 'h1') {
          return <Box key={idx} as="h1" fontSize="1.4em" fontWeight="700" mt="16px" mb="8px" dangerouslySetInnerHTML={{ __html: block.content }} />
        }
        if (block.type === 'h2') {
          return <Box key={idx} as="h2" fontSize="1.2em" fontWeight="600" mt="14px" mb="8px" dangerouslySetInnerHTML={{ __html: block.content }} />
        }
        if (block.type === 'h3') {
          return <Box key={idx} as="h3" fontSize="1.1em" fontWeight="600" mt="12px" mb="6px" dangerouslySetInnerHTML={{ __html: block.content }} />
        }
        if (block.type === 'quote') {
          return <Box key={idx} borderLeft="3px solid #22c55e" pl="12px" py="4px" bg="#f0fdf4" rounded="0 6px 6px 0" mb="8px" color="#555" dangerouslySetInnerHTML={{ __html: block.content }} />
        }
        if (block.type === 'code') {
          return <Box key={idx} as="pre" bg="#f8fafc" p="12px" rounded="8px" mb="8px" overflow="auto" fontSize="0.9em" fontFamily="monospace" whiteSpace="pre-wrap"><code>{block.content}</code></Box>
        }
        if (block.type === 'list') {
          return (
            <Box key={idx} as="ul" pl="20px" mb="8px" style={{ listStyleType: 'disc' }}>
              {block.items.map(function(item, i) {
                return <Box key={i} as="li" mb="4px" dangerouslySetInnerHTML={{ __html: item }} />
              })}
            </Box>
          )
        }
        if (block.type === 'hr') {
          return <Box key={idx} as="hr" borderColor="#e2e8f0" my="12px" />
        }
        return null
      })}
    </Box>
  )
}

export default SimpleRenderer
