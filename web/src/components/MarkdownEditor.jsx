import React, { useCallback } from 'react'
import MDEditor from '@uiw/react-md-editor'
import { Box } from '@chakra-ui/react'

const MarkdownEditor = React.forwardRef(function MarkdownEditor(props, ref) {
  var { value, onChange, placeholder, height, preview } = props
  height = height || 300
  preview = preview || 'live'

  var handleChange = useCallback(function(val) {
    if (onChange) onChange(val || '')
  }, [onChange])

  return (
    <Box data-color-mode="light">
      <MDEditor
        ref={ref}
        value={value || ''}
        onChange={handleChange}
        height={height}
        preview={preview}
        placeholder={placeholder}
        visibleDragbar={false}
        style={{ borderRadius: '8px', border: '1px solid #d1d5db' }}
      />
    </Box>
  )
})

export default MarkdownEditor
