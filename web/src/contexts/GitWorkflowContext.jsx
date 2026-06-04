import React, { createContext, useContext, useReducer, useCallback } from 'react'
import { reposAPI } from '../api/index'

var GitWorkflowContext = createContext(null)

var initialState = {
  working_status: {
    staged: [],
    unstaged: [],
    untracked: [],
    current_branch: '',
    rebasing: false,
    merging: false,
    reverting: false,
    cherry_picking: false,
    conflict_files: [],
  },
  diff: null,
  diff_loading: false,
  diff_mode: 'working',
  selected_file: null,
  selected_lines: [],
  conflict_info: null,
  stash_list: [],
  stash_loading: false,
  loading: false,
  error: null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return Object.assign({}, state, { loading: action.payload })
    case 'SET_ERROR':
      return Object.assign({}, state, { error: action.payload, loading: false })
    case 'SET_WORKING_STATUS':
      return Object.assign({}, state, {
        working_status: action.payload,
        loading: false,
        error: null,
      })
    case 'SET_DIFF':
      return Object.assign({}, state, { diff: action.payload, diff_loading: false })
    case 'SET_DIFF_LOADING':
      return Object.assign({}, state, { diff_loading: action.payload })
    case 'SET_DIFF_MODE':
      return Object.assign({}, state, { diff_mode: action.payload })
    case 'SET_SELECTED_FILE':
      return Object.assign({}, state, { selected_file: action.payload, selected_lines: [], diff: null })
    case 'TOGGLE_LINE_SELECTION': {
      var lineIdx = action.payload
      var newSel = state.selected_lines.indexOf(lineIdx) >= 0
        ? state.selected_lines.filter(function(i) { return i !== lineIdx })
        : state.selected_lines.concat([lineIdx])
      return Object.assign({}, state, { selected_lines: newSel })
    }
    case 'CLEAR_LINE_SELECTION':
      return Object.assign({}, state, { selected_lines: [] })
    case 'SET_CONFLICT_INFO':
      return Object.assign({}, state, { conflict_info: action.payload })
    case 'SET_STASH_LIST':
      return Object.assign({}, state, { stash_list: action.payload, stash_loading: false })
    case 'SET_STASH_LOADING':
      return Object.assign({}, state, { stash_loading: action.payload })
    default:
      return state
  }
}

export function GitWorkflowProvider(_ref) {
  var owner = _ref.owner
  var repo = _ref.repo
  var children = _ref.children

  var _useReducer = useReducer(reducer, initialState)
  var state = _useReducer[0]
  var dispatch = _useReducer[1]

  var refreshStatus = useCallback(function() {
    dispatch({ type: 'SET_LOADING', payload: true })
    return reposAPI.getGitStatus(owner, repo).then(function(data) {
      var staged = (data.staged || []).map(function(f) {
        return typeof f === 'string' ? { path: f, status: 'modified', group: 'staged' } : Object.assign({}, f, { group: 'staged' })
      })
      var unstaged = (data.unstaged || []).map(function(f) {
        return typeof f === 'string' ? { path: f, status: 'modified', group: 'unstaged' } : Object.assign({}, f, { group: 'unstaged' })
      })
      var untracked = (data.untracked || []).map(function(f) {
        return typeof f === 'string' ? { path: f, status: 'untracked', group: 'untracked' } : Object.assign({}, f, { group: 'untracked' })
      })
      var conflictInfo = null
      if (data.rebasing || data.merging || data.reverting || data.cherry_picking) {
        conflictInfo = {
          type: data.rebasing ? 'rebase' : data.merging ? 'merge' : data.cherry_picking ? 'cherry_pick' : 'revert',
          active: true,
          conflict_files: data.conflict_files || [],
        }
      }
      dispatch({ type: 'SET_WORKING_STATUS', payload: {
        staged: staged,
        unstaged: unstaged,
        untracked: untracked,
        current_branch: data.current_branch || data.branch || '',
        rebasing: !!data.rebasing,
        merging: !!data.merging,
        reverting: !!data.reverting,
        cherry_picking: !!data.cherry_picking,
        conflict_files: data.conflict_files || [],
      }})
      dispatch({ type: 'SET_CONFLICT_INFO', payload: conflictInfo })
    }).catch(function(err) {
      dispatch({ type: 'SET_ERROR', payload: err.message || '获取工作区状态失败' })
    })
  }, [owner, repo])

  var loadDiff = useCallback(function(filePath, mode) {
    dispatch({ type: 'SET_DIFF_LOADING', payload: true })
    dispatch({ type: 'SET_DIFF_MODE', payload: mode || 'working' })
    var staged = (mode || state.diff_mode) === 'staged'
    return reposAPI.diff(owner, repo, filePath, staged).then(function(data) {
      dispatch({ type: 'SET_DIFF', payload: data })
    }).catch(function(err) {
      dispatch({ type: 'SET_DIFF', payload: null })
      dispatch({ type: 'SET_DIFF_LOADING', payload: false })
    })
  }, [owner, repo, state.diff_mode])

  var selectFile = useCallback(function(filePath) {
    dispatch({ type: 'SET_SELECTED_FILE', payload: filePath })
    if (filePath) {
      loadDiff(filePath, state.diff_mode)
    }
  }, [loadDiff, state.diff_mode])

  var toggleLine = useCallback(function(lineIdx) {
    dispatch({ type: 'TOGGLE_LINE_SELECTION', payload: lineIdx })
  }, [])

  var clearLineSelection = useCallback(function() {
    dispatch({ type: 'CLEAR_LINE_SELECTION' })
  }, [])

  var refreshStashList = useCallback(function() {
    dispatch({ type: 'SET_STASH_LOADING', payload: true })
    return reposAPI.stashList(owner, repo).then(function(data) {
      dispatch({ type: 'SET_STASH_LIST', payload: data.stashes || data || [] })
    }).catch(function() {
      dispatch({ type: 'SET_STASH_LIST', payload: [] })
    })
  }, [owner, repo])

  var value = Object.assign({}, state, {
    owner: owner,
    repo: repo,
    refreshStatus: refreshStatus,
    loadDiff: loadDiff,
    selectFile: selectFile,
    toggleLine: toggleLine,
    clearLineSelection: clearLineSelection,
    refreshStashList: refreshStashList,
  })

  return React.createElement(GitWorkflowContext.Provider, { value: value }, children)
}

export function useGitWorkflow() {
  var ctx = useContext(GitWorkflowContext)
  if (!ctx) throw new Error('useGitWorkflow must be used within GitWorkflowProvider')
  return ctx
}

export default GitWorkflowContext