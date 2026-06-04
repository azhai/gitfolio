import React from 'react'
import { Menu, MenuButton, MenuList, MenuItem, Button, Tooltip, MenuDivider } from '@chakra-ui/react'
import { t } from '../../i18n/index'

var CommitActionMenu = function(_ref) {
  var commitHash = _ref.commitHash
  var onCherryPick = _ref.onCherryPick
  var onRevert = _ref.onRevert
  var onReset = _ref.onReset
  var onRebase = _ref.onRebase
  var onDeleteCommit = _ref.onDeleteCommit
  var onSelectRange = _ref.onSelectRange
  var isGuest = _ref.isGuest

  if (isGuest) return null

  return (
    <Menu>
      <Tooltip label={t('gitWorkflow.commitActions')} placement="top" hasArrow>
        <MenuButton h="22px" px="6px" fontSize="10px" rounded="4px"
          as={Button} variant="ghost" color="#6b7280" _hover={{ bg: '#f3f4f6' }}>
          ⋯
        </MenuButton>
      </Tooltip>
      <MenuList minW="220px" fontSize="11px">
        <MenuItem onClick={function() { onCherryPick && onCherryPick(commitHash) }}
          _hover={{ bg: '#f0fdf4' }}>
          🍒 {t('gitWorkflow.cherryPick')} — {t('gitWorkflow.cherryPickHint')}
        </MenuItem>
        <MenuItem onClick={function() { onRevert && onRevert(commitHash) }}
          _hover={{ bg: '#fef2f2' }}>
          ↩ {t('gitWorkflow.revert')} — {t('gitWorkflow.revertHint')}
        </MenuItem>
        <MenuDivider />
        <MenuItem onClick={function() { onSelectRange && onSelectRange(commitHash) }}
          _hover={{ bg: '#fffbeb' }}>
          ☐ {t('gitWorkflow.selectForDelete')} — {t('gitWorkflow.selectForDeleteHint')}
        </MenuItem>
        <MenuItem onClick={function() { onDeleteCommit && onDeleteCommit(commitHash) }}
          _hover={{ bg: '#fef2f2' }}>
          ✕ {t('gitWorkflow.deleteCommit')} — {t('gitWorkflow.deleteCommitHint')}
        </MenuItem>
        <MenuDivider />
        <MenuItem onClick={function() { onReset && onReset(commitHash) }}
          _hover={{ bg: '#fffbeb' }}>
          ⏪ {t('gitWorkflow.reset')} — {t('gitWorkflow.resetHint')}
        </MenuItem>
        <MenuItem onClick={function() { onRebase && onRebase(commitHash) }}
          _hover={{ bg: '#f5f3ff' }}>
          🔀 {t('gitWorkflow.rebaseInteractive')} — {t('gitWorkflow.rebaseHint')}
        </MenuItem>
      </MenuList>
    </Menu>
  )
}

export default CommitActionMenu
