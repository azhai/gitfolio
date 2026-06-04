import React, { useState } from 'react'
import { Flex, Text, Select, Box } from '@chakra-ui/react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

var ACTION_OPTIONS = [
  { value: 'pick', label: 'pick' },
  { value: 'squash', label: 'squash' },
  { value: 'reword', label: 'reword' },
  { value: 'edit', label: 'edit' },
  { value: 'drop', label: 'drop' },
]

var RebaseTodoItem = function(_ref) {
  var item = _ref.item
  var index = _ref.index
  var onActionChange = _ref.onActionChange

  var _useSortable = useSortable({ id: item.hash })
  var attributes = _useSortable.attributes
  var listeners = _useSortable.listeners
  var setNodeRef = _useSortable.setNodeRef
  var transform = _useSortable.transform
  var transition = _useSortable.transition
  var isDragging = _useSortable.isDragging

  var style = {
    transform: CSS.Transform.toString(transform),
    transition: transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <Flex ref={setNodeRef} style={style} align="center" px="8px" py="4px"
      bg={item.action === 'drop' ? '#fef2f2' : 'white'}
      borderBottom="1px solid" borderColor="#f3f4f6"
      _hover={{ bg: '#f9fafb' }}>
      <Text fontSize="12px" color="#9ca3af" cursor="grab" mr="8px" {...attributes} {...listeners}>⠿</Text>
      <Select h="22px" w="80px" fontSize="10px" rounded="3px"
        value={item.action}
        onChange={function(e) { onActionChange(index, e.target.value) }}
        bg={item.action === 'drop' ? '#fef2f2' : item.action === 'squash' ? '#fef3c7' : item.action === 'edit' ? '#f0fdf4' : 'white'}>
        {ACTION_OPTIONS.map(function(opt) {
          return <option key={opt.value} value={opt.value}>{opt.label}</option>
        })}
      </Select>
      <Text fontSize="11px" color="#6b7280" fontFamily="monospace" ml="8px" w="60px" flexShrink={0}>{item.hash.substring(0, 7)}</Text>
      <Text fontSize="11px" color="#374151" ml="8px" noOfLines={1}>{item.message}</Text>
    </Flex>
  )
}

export default RebaseTodoItem