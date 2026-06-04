/**
 * @typedef {'added'|'modified'|'deleted'|'renamed'|'untracked'} FileStatus
 */

/**
 * @typedef {'staged'|'unstaged'|'untracked'} ChangeGroup
 */

/**
 * @typedef {Object} WorkingFile
 * @property {string} path - 文件路径
 * @property {FileStatus} status - 变更状态
 * @property {ChangeGroup} group - 所属分组
 * @property {boolean} is_binary - 是否二进制文件
 */

/**
 * @typedef {Object} DiffLine
 * @property {string} type - 'added'|'deleted'|'context'|'hunk'
 * @property {string} content - 行内容
 * @property {number} old_line_no - 旧行号（-1表示无）
 * @property {number} new_line_no - 新行号（-1表示无）
 * @property {boolean} selected - 是否被选中（行级暂存）
 */

/**
 * @typedef {Object} DiffResult
 * @property {string} file_path - 文件路径
 * @property {DiffLine[]} lines - diff行列表
 * @property {boolean} is_binary - 是否二进制文件
 * @property {number} additions - 新增行数
 * @property {number} deletions - 删除行数
 */

/**
 * @typedef {Object} WorkingStatus
 * @property {WorkingFile[]} staged - 已暂存文件
 * @property {WorkingFile[]} unstaged - 未暂存文件
 * @property {WorkingFile[]} untracked - 未跟踪文件
 * @property {string} current_branch - 当前分支
 * @property {boolean} rebasing - 是否rebase中
 * @property {boolean} merging - 是否merge中
 * @property {boolean} reverting - 是否revert中
 * @property {boolean} cherry_picking - 是否cherry-pick中
 * @property {string[]} conflict_files - 冲突文件列表
 */

/**
 * @typedef {Object} CommitMessage
 * @property {string} title - 提交标题
 * @property {string} body - 提交正文
 */

/**
 * @typedef {'pick'|'squash'|'reword'|'edit'|'drop'} RebaseAction
 */

/**
 * @typedef {Object} RebaseTodoItem
 * @property {RebaseAction} action - 操作类型
 * @property {string} hash - 提交hash
 * @property {string} message - 提交信息
 */

/**
 * @typedef {Object} StashEntry
 * @property {number} index - stash索引
 * @property {string} message - stash消息
 * @property {string} date - 日期
 */

/**
 * @typedef {Object} ConflictInfo
 * @property {'rebase'|'merge'|'cherry_pick'|'revert'} type - 操作类型
 * @property {boolean} active - 是否活跃
 * @property {string} [message] - 错误消息
 * @property {string[]} [conflict_files] - 冲突文件列表
 */