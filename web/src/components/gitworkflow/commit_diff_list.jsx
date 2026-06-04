import React from 'react'
import { Box, Text } from '@chakra-ui/react'
import { t } from '../../i18n/index'
import FileDiffBlock from './file_diff_block'

var CommitDiffList = function(_ref) {
  var owner = _ref.owner
  var repo = _ref.repo
  var sha = _ref.sha
  var files = _ref.files

  if (!files || files.length === 0) return null

  return (
    <Box>
      <Text fontSize="13px" fontWeight="600" color="#333" mb="10px">
        {t('commitDetail.changedFiles')} ({files.length})
      </Text>
      {files.map(function(f, idx) {
        return (
          <FileDiffBlock key={f.filename || f.name || f.path || idx}
            owner={owner} repo={repo} file={f} sha={sha} />
        )
      })}
    </Box>
  )
}

export default CommitDiffList