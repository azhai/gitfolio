package helpers

import (
	"regexp"
	"strconv"

	"github.com/azhai/gitfolio/models"
	"github.com/azhai/goent"
)

type CommitRef struct {
	TargetType string
	TargetID   int64
	Action     string
}

var refPatterns = []*struct {
	regex  *regexp.Regexp
	action string
	target string
}{
	{regexp.MustCompile(`(?i)\b(fixes|closes|resolves)\s+#(\d+)`), "closes", "issue"},
	{regexp.MustCompile(`(?i)\b(references|refs?|see)\s+#(\d+)`), "references", "issue"},
	{regexp.MustCompile(`(?i)\bPR\s+#(\d+)`), "references", "pull_request"},
	{regexp.MustCompile(`(?i)\bTask[-:]?\s*#(\d+)`), "references", "task"},
}

func ParseCommitReferences(message string) []CommitRef {
	var refs []CommitRef
	seen := make(map[string]bool)

	for _, pattern := range refPatterns {
		matches := pattern.regex.FindAllStringSubmatch(message, -1)
		for _, match := range matches {
			idStr := match[len(match)-1]
			id, err := strconv.ParseInt(idStr, 10, 64)
			if err != nil || id == 0 {
				continue
			}
			key := pattern.target + ":" + idStr
			if seen[key] {
				continue
			}
			seen[key] = true
			refs = append(refs, CommitRef{
				TargetType: pattern.target,
				TargetID:   id,
				Action:     pattern.action,
			})
		}
	}
	return refs
}

func CreateCommitReferences(db *models.Database, commitHash string, repoID int64, message string) {
	refs := ParseCommitReferences(message)
	for _, ref := range refs {
		existing, _ := db.CommitReference.Select().Filter(
			goent.And(
				goent.Equals(db.CommitReference.Field("commit_hash"), commitHash),
				goent.Equals(db.CommitReference.Field("target_type"), ref.TargetType),
				goent.Equals(db.CommitReference.Field("target_id"), ref.TargetID),
			),
		).One()
		if existing != nil {
			continue
		}

		record := &models.CommitReference{
			CommitHash:   commitHash,
			RepositoryID: repoID,
			TargetType:   ref.TargetType,
			TargetID:     ref.TargetID,
			Action:       ref.Action,
		}
		db.CommitReference.Insert().One(record)

		if ref.Action == "closes" && ref.TargetType == "issue" {
			issue, err := db.Issue.Select().Where("id = ? AND repository_id = ?", ref.TargetID, repoID).One()
			if err == nil && issue != nil && !issue.IsClosed {
				issue.IsClosed = true
				db.Issue.Save().One(issue)
			}
		}
	}
}

func GetCommitReferences(db *models.Database, commitHash string) []CommitRef {
	records, err := db.CommitReference.Select().Where("commit_hash = ?", commitHash).All()
	if err != nil {
		return nil
	}
	var refs []CommitRef
	for _, r := range records {
		refs = append(refs, CommitRef{
			TargetType: r.TargetType,
			TargetID:   r.TargetID,
			Action:     r.Action,
		})
	}
	return refs
}
