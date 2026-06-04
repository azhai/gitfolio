import React from 'react'
import { Box, Flex, Text, Checkbox } from '@chakra-ui/react'

var DiffLine = function(_ref) {
  var line = _ref.line
  var index = _ref.index
  var selectable = _ref.selectable
  var selected = _ref.selected
  var onToggle = _ref.onToggle

  if (line.type === 'hunk') {
    return (
      <Box bg="#f8fafc" px="12px" py="3px" fontSize="12px" color="#6b7280" fontFamily="monospace">
        {line.content}
      </Box>
    )
  }

  var bgColor = line.type === 'added' ? '#f0fdf4' : line.type === 'deleted' ? '#fef2f2' : 'transparent'
  var textColor = line.type === 'added' ? '#16a34a' : line.type === 'deleted' ? '#dc2626' : '#374151'
  var isChange = line.type === 'added' || line.type === 'deleted'

  return (
    <Flex bg={bgColor} px="8px" py="0" fontSize="12px" fontFamily="monospace" align="stretch" minH="20px" _hover={isChange ? { bg: line.type === 'added' ? '#bbf7d0' : '#fecaca' } : undefined}>
      {selectable && isChange && (
        <Box w="24px" display="flex" alignItems="center" justifyContent="center" flexShrink={0}>
          <Checkbox size="sm" isChecked={selected} onChange={function() { onToggle(index) }} colorScheme="green" />
        </Box>
      )}
      {!selectable && isChange && <Box w="24px" flexShrink={0} />}
      <Text w="44px" textAlign="right" pr="8px" color="#9ca3af" flexShrink={0} userSelect="none" lineHeight="20px">
        {line.old_line_no >= 0 ? line.old_line_no : ''}
      </Text>
      <Text w="44px" textAlign="right" pr="8px" color="#9ca3af" flexShrink={0} userSelect="none" lineHeight="20px">
        {line.new_line_no >= 0 ? line.new_line_no : ''}
      </Text>
      <Text flex={1} color={textColor} whiteSpace="pre" lineHeight="20px">{line.content}</Text>
    </Flex>
  )
}

export default DiffLine