package models

import "time"

// goent writes created_at/updated_at verbatim, so rows inserted without them
// end up as 0001-01-01 and render as "-" everywhere. Stamp() fills the zero
// values right before an insert.
func stamp(created, updated *time.Time) {
	now := time.Now()
	if created != nil && created.IsZero() {
		*created = now
	}
	if updated != nil {
		*updated = now
	}
}

func (t *Issue) Stamp()       { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *Comment) Stamp()     { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *PullRequest) Stamp() { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *Group) Stamp()       { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *Repository) Stamp()  { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *User) Stamp()        { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *Task) Stamp()        { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *Milestone) Stamp()   { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *Snippet) Stamp()     { stamp(&t.CreatedAt, &t.UpdatedAt) }
func (t *Label) Stamp()       { stamp(&t.CreatedAt, &t.UpdatedAt) }

// These tables only track creation time.
func (t *GroupMember) Stamp()    { stamp(&t.CreatedAt, nil) }
func (t *Activity) Stamp()       { stamp(&t.CreatedAt, nil) }
func (t *TaskAttachment) Stamp() { stamp(&t.CreatedAt, nil) }
