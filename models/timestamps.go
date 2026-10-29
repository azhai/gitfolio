package models

import "time"

// goent writes created_at/updated_at verbatim, so rows inserted without them
// end up as 0001-01-01 and render as "-" everywhere. Stamp() fills the zero
// values right before an insert.
//
// 时间列是 timestamp without time zone，驱动按 UTC 读回来，helpers.FormatTime 再转成
// 东八区展示，所以入库必须是 UTC；写成本地时间会让界面凭空多出 8 小时。
func stamp(created, updated *time.Time) {
	now := time.Now().UTC()
	if created != nil && created.IsZero() {
		*created = now
	}
	if updated != nil {
		*updated = now
	}
}

func (t *Issue) Stamp()            { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *Comment) Stamp()          { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *PullRequest) Stamp()      { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *Group) Stamp()            { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *Repository) Stamp()       { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *User) Stamp()             { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *Task) Stamp()             { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *Milestone) Stamp()        { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *Snippet) Stamp()          { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *Label) Stamp()            { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *Branch) Stamp()           { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *Release) Stamp()          { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *Webhook) Stamp()          { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *PlatformAccount) Stamp()  { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *SyncToken) Stamp()        { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *RemoteRepository) Stamp() { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *SyncPoint) Stamp()        { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *RepositoryStats) Stamp()  { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *Contributor) Stamp()      { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *Backup) Stamp()           { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *TaskSchedule) Stamp()     { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *ETag) Stamp()             { stamp(&t.CreatedAt, &t.UpdatedAt) }

// These tables only track creation time.
func (t *GroupMember) Stamp()      { stamp(&t.CreatedAt, nil) }
func (t *Activity) Stamp()         { stamp(&t.CreatedAt, nil) }
func (t *TaskAttachment) Stamp()   { stamp(&t.CreatedAt, nil) }
func (t *Star) Stamp()             { stamp(&t.CreatedAt, nil) }
func (t *Watch) Stamp()            { stamp(&t.CreatedAt, nil) }
func (t *IssueLabel) Stamp()       { stamp(&t.CreatedAt, nil) }
func (t *PullRequestLabel) Stamp() { stamp(&t.CreatedAt, nil) }
func (t *SyncLog) Stamp()          { stamp(&t.CreatedAt, nil) }
func (t *GitCommandLog) Stamp()    { stamp(&t.CreatedAt, nil) }
func (t *CommitReference) Stamp()  { stamp(&t.CreatedAt, nil) }
func (t *TaskIssue) Stamp()        { stamp(&t.CreatedAt, nil) }
func (t *TaskTransition) Stamp()   { stamp(&t.CreatedAt, nil) }
func (t *TaskPullRequest) Stamp()  { stamp(&t.CreatedAt, nil) }
func (t *TaskTimeLog) Stamp()      { stamp(&t.CreatedAt, nil) }
