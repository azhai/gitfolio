import React, { useRef, useCallback } from 'react'
import { Box, Flex, HStack, Text, useDisclosure } from '@chakra-ui/react'
import { LuBold as Bold, LuItalic as Italic, LuLink as LinkIcon, LuHash as Hash, LuList as List, LuCode as Code } from 'react-icons/lu'
import { t } from '../i18n'

function ToolbarButton(props) {
  var { icon: Icon, label, onClick, active } = props
  return (
    <Box as="button" type="button"
      px="6px" py="4px" rounded="4px" cursor="pointer"
      bg={active ? '#f0fdf4' : 'transparent'}
      color={active ? '#16a34a' : '#666'}
      _hover={{ bg: '#f3f4f6', color: '#333' }}
      transition="all 0.1s"
      onClick={onClick}
      title={label}
      display="flex" alignItems="center" justifyContent="center">
      <Icon size={14} />
    </Box>
  )
}

var SimpleEditor = React.forwardRef(function SimpleEditor(props, ref) {
  var { value, onChange, placeholder, height, owner, repo } = props
  height = height || 200
  var textareaRef = useRef(null)
  var actualRef = ref || textareaRef

  var insertText = useCallback(function(before, after, defaultText) {
    var textarea = actualRef.current
    if (!textarea) return
    var start = textarea.selectionStart
    var end = textarea.selectionEnd
    var selected = value.substring(start, end) || defaultText || ''
    var newText = value.substring(0, start) + before + selected + after + value.substring(end)
    if (onChange) onChange(newText)
    requestAnimationFrame(function() {
      textarea.focus()
      var cursorPos = start + before.length + selected.length
      textarea.setSelectionRange(cursorPos, cursorPos)
    })
  }, [value, onChange, actualRef])

  var handleBold = useCallback(function() { insertText('**', '**', t('editor.bold')) }, [insertText])
  var handleItalic = useCallback(function() { insertText('*', '*', t('editor.italic')) }, [insertText])
  var handleCode = useCallback(function() { insertText('`', '`', t('editor.code')) }, [insertText])
  var handleLink = useCallback(function() { insertText('[', '](url)', t('editor.linkText')) }, [insertText])
  var handleList = useCallback(function() { insertText('\n- ', '', t('editor.listItem')) }, [insertText])

  var handleInsertIssue = useCallback(function() {
    var textarea = actualRef.current
    if (!textarea) return
    var start = textarea.selectionStart
    var issueNum = window.prompt(t('editor.enterIssueNumber'))
    if (!issueNum) return
    var insert = '#' + issueNum
    var newText = value.substring(0, start) + insert + value.substring(start)
    if (onChange) onChange(newText)
    requestAnimationFrame(function() {
      textarea.focus()
      var cursorPos = start + insert.length
      textarea.setSelectionRange(cursorPos, cursorPos)
    })
  }, [value, onChange, actualRef])

  var handleChange = useCallback(function(e) {
    if (onChange) onChange(e.target.value)
  }, [onChange])

  var handleKeyDown = useCallback(function(e) {
    if (e.key === 'Tab') {
      e.preventDefault()
      var textarea = e.target
      var start = textarea.selectionStart
      var end = textarea.selectionEnd
      var newVal = value.substring(0, start) + '  ' + value.substring(end)
      if (onChange) onChange(newVal)
      requestAnimationFrame(function() {
        textarea.setSelectionRange(start + 2, start + 2)
      })
    }
  }, [value, onChange])

  return (
    <Box border="1px solid #d1d5db" rounded="8px" overflow="hidden" transition="border-color 0.15s"
      _focusWithin={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }}>
      <Flex align="center" gap="2px" px="8px" py="4px" bg="#f9fafb" borderBottom="1px solid #e5e7eb">
        <ToolbarButton icon={Bold} label={t('editor.bold')} onClick={handleBold} />
        <ToolbarButton icon={Italic} label={t('editor.italic')} onClick={handleItalic} />
        <ToolbarButton icon={Code} label={t('editor.code')} onClick={handleCode} />
        <ToolbarButton icon={LinkIcon} label={t('editor.linkText')} onClick={handleLink} />
        <ToolbarButton icon={List} label={t('editor.listItem')} onClick={handleList} />
        <Box w="1px" h="16px" bg="#d1d5db" mx="4px" />
        <ToolbarButton icon={Hash} label={t('editor.insertIssue')} onClick={handleInsertIssue} />
      </Flex>
      <Box as="textarea" ref={actualRef} value={value || ''} onChange={handleChange} onKeyDown={handleKeyDown}
        placeholder={placeholder}
        display="block" w="full" px="12px" py="10px"
        fontSize="14px" lineHeight="1.7" color="#333" bg="white"
        border="none" outline="none" resize="vertical"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        style={{ minHeight: height + 'px', WebkitAppearance: 'none' }}
        _placeholder={{ color: '#aaa' }}
      />
    </Box>
  )
})

export default SimpleEditor
