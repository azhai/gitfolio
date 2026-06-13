import React, { useMemo, useCallback } from 'react'
import Markdown from '@uiw/react-markdown-preview'
import { Box } from '@chakra-ui/react'

function getRawUrl(owner, repo, filePath, ref) {
  var encodedPath = filePath.split('/').map(function(s) { return encodeURIComponent(s) }).join('/')
  return '/api/v1/' + owner + '/' + repo + '/raw/' + encodedPath + '?ref=' + (ref || 'HEAD')
}

function resolveImageUrl(src, owner, repo, filePath, ref) {
  if (!src) return src
  if (/^(https?:\/\/|\/\/|data:|\/)/.test(src)) return src
  var dir = filePath.substring(0, filePath.lastIndexOf('/'))
  var resolved = dir ? dir + '/' + src : src
  resolved = resolved.replace(/^\.\//, '')
  resolved = resolved.replace(/\/[^/]+\/\.\.\//g, '/')
  return getRawUrl(owner, repo, resolved, ref)
}

function resolveLinkUrl(href, owner, repo, filePath, ref) {
  if (!href) return href
  if (/^(https?:\/\/|\/\/|\/|#|mailto:)/.test(href)) return href
  var dir = filePath.substring(0, filePath.lastIndexOf('/'))
  var resolved = dir ? dir + '/' + href : href
  resolved = resolved.replace(/^\.\//, '')
  resolved = resolved.replace(/\/[^/]+\/\.\.\//g, '/')
  return '/' + owner + '/' + repo + '/tree/' + (ref && ref !== 'HEAD' ? ref + '/' : '') + resolved
}

var MarkdownRenderer = function(props) {
  var source = props.source
  var owner = props.owner
  var repo = props.repo
  var filePath = props.filePath
  var gitRef = props.gitRef
  var fontSize = props.fontSize || '14px'

  var rewriteUrl = useCallback(function(url, type) {
    if (type === 'image') return resolveImageUrl(url, owner, repo, filePath, gitRef)
    if (type === 'link') return resolveLinkUrl(url, owner, repo, filePath, gitRef)
    return url
  }, [owner, repo, filePath, gitRef])

  var components = useMemo(function() {
    return {
      img: function(imgProps) {
        return React.createElement('img', {
          src: rewriteUrl(imgProps.src, 'image'),
          alt: imgProps.alt || '',
          style: { maxWidth: '100%', borderRadius: '6px' },
        })
      },
      a: function(aProps) {
        var href = rewriteUrl(aProps.href, 'link')
        return React.createElement('a', {
          href: href,
          target: aProps.href && /^(https?:\/\/|\/\/)/.test(aProps.href) ? '_blank' : undefined,
          rel: aProps.href && /^(https?:\/\/|\/\/)/.test(aProps.href) ? 'noopener noreferrer' : undefined,
        }, aProps.children)
      },
    }
  }, [rewriteUrl])

  if (!source) return null

  return (
    <Box data-color-mode="light" className="markdown-body" sx={{
      '& .wmde-markdown': {
        fontSize: fontSize,
        lineHeight: '1.7',
        backgroundColor: 'transparent',
        padding: '0',
        color: '#1f2328',
      },
      '& .wmde-markdown p': {
        marginBottom: '10px',
        lineHeight: '1.7',
      },
      '& .wmde-markdown h1, & .wmde-markdown h2, & .wmde-markdown h3, & .wmde-markdown h4, & .wmde-markdown h5, & .wmde-markdown h6': {
        marginTop: '24px',
        marginBottom: '16px',
        fontWeight: '600',
        lineHeight: '1.25',
        borderBottom: 'none',
        color: '#1f2328',
      },
      '& .wmde-markdown h1': { fontSize: '2em', paddingBottom: '0.3em', borderBottom: '1px solid #d0d7de' },
      '& .wmde-markdown h2': { fontSize: '1.5em', paddingBottom: '0.3em', borderBottom: '1px solid #d0d7de' },
      '& .wmde-markdown h3': { fontSize: '1.25em' },
      '& .wmde-markdown h4': { fontSize: '1em' },
      '& .wmde-markdown code': {
        backgroundColor: '#eff1f3',
        padding: '0.2em 0.4em',
        borderRadius: '6px',
        fontSize: '120%',
        fontFamily: "'Liberation Mono', Menlo, 'SFMono-Regular', Consolas, monospace",
        color: '#1f2328',
      },
      '& .wmde-markdown pre': {
        backgroundColor: '#f6f8fa',
        borderRadius: '6px',
        padding: '16px',
        overflow: 'auto',
      },
      '& .wmde-markdown pre code': {
        backgroundColor: 'transparent',
        padding: '0',
        borderRadius: '0',
        fontSize: '120%',
        lineHeight: '1.45',
      },
      '& .wmde-markdown blockquote': {
        borderLeft: '4px solid #d0d7de',
        padding: '0 1em',
        color: '#656d76',
        backgroundColor: 'transparent',
        borderRadius: '0',
      },
      '& .wmde-markdown img': {
        maxWidth: '100%',
        borderRadius: '6px',
        boxSizing: 'border-box',
      },
      '& .wmde-markdown table': {
        borderCollapse: 'collapse',
        width: '100%',
        overflow: 'auto',
      },
      '& .wmde-markdown th, & .wmde-markdown td': {
        border: '1px solid #d0d7de',
        padding: '6px 13px',
      },
      '& .wmde-markdown th': {
        backgroundColor: '#f6f8fa',
        fontWeight: '600',
      },
      '& .wmde-markdown tr': {
        backgroundColor: 'transparent',
        borderTop: '1px solid #d0d7de',
      },
      '& .wmde-markdown tr:nth-child(2n)': {
        backgroundColor: '#f6f8fa',
      },
      '& .wmde-markdown a': {
        color: '#0969da',
        textDecoration: 'none',
      },
      '& .wmde-markdown a:hover': {
        textDecoration: 'underline',
      },
      '& .wmde-markdown hr': {
        borderColor: '#d0d7de',
        borderBottom: '1px solid #d0d7de',
      },
      '& .wmde-markdown ul, & .wmde-markdown ol': {
        paddingLeft: '2em',
        marginBottom: '16px',
      },
      '& .wmde-markdown li': {
        marginBottom: '4px',
        lineHeight: '1.7',
      },
      '& .wmde-markdown li + li': {
        marginTop: '4px',
      },
      '& .wmde-markdown .copied': {
        display: 'none',
      },
      '& .wmde-markdown .wmde-markdown-color': {
        backgroundColor: 'transparent',
      },
    }}>
      <Markdown source={source} components={components} />
    </Box>
  )
}

export default MarkdownRenderer
