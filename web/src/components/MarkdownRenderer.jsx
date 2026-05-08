import React from 'react'
import Markdown from '@uiw/react-markdown-preview'
import { Box } from '@chakra-ui/react'

const MarkdownRenderer = function(props) {
  var { source, fontSize } = props
  fontSize = fontSize || '14px'

  if (!source) return null

  return (
    <Box data-color-mode="light" className="markdown-body" sx={{
      '& .wmde-markdown': {
        fontSize: fontSize,
        lineHeight: '1.7',
        backgroundColor: 'transparent',
        padding: '0',
      },
      '& .wmde-markdown p': {
        marginBottom: '8px',
      },
      '& .wmde-markdown h1, & .wmde-markdown h2, & .wmde-markdown h3, & .wmde-markdown h4': {
        marginTop: '16px',
        marginBottom: '8px',
        fontWeight: '600',
        borderBottom: 'none',
      },
      '& .wmde-markdown code': {
        backgroundColor: '#f1f5f9',
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '0.9em',
      },
      '& .wmde-markdown pre': {
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        padding: '12px',
      },
      '& .wmde-markdown pre code': {
        backgroundColor: 'transparent',
        padding: '0',
      },
      '& .wmde-markdown blockquote': {
        borderLeft: '3px solid #22c55e',
        padding: '4px 12px',
        color: '#555',
        backgroundColor: '#f0fdf4',
        borderRadius: '0 6px 6px 0',
      },
      '& .wmde-markdown img': {
        maxWidth: '100%',
        borderRadius: '6px',
      },
      '& .wmde-markdown table': {
        borderCollapse: 'collapse',
        width: '100%',
      },
      '& .wmde-markdown th, & .wmde-markdown td': {
        border: '1px solid #e2e8f0',
        padding: '8px 12px',
      },
      '& .wmde-markdown th': {
        backgroundColor: '#f8fafc',
      },
      '& .wmde-markdown a': {
        color: '#22c55e',
        textDecoration: 'underline',
      },
      '& .wmde-markdown hr': {
        borderColor: '#e2e8f0',
      },
      '& .wmde-markdown ul, & .wmde-markdown ol': {
        paddingLeft: '20px',
      },
      '& .wmde-markdown li': {
        marginBottom: '4px',
      },
    }}>
      <Markdown source={source} />
    </Box>
  )
}

export default MarkdownRenderer
