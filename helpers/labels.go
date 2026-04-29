package helpers

import (
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/goent"
)

// LabelInfo 标签摘要，用于 API 响应
type LabelInfo struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Color       string `json:"color"`
	Description string `json:"description,omitempty"`
}

// DefaultLabels 仓库默认标签定义
var DefaultLabels = []struct {
	Name        string
	Color       string
	Description string
}{
	{"Bug", "#d73a4a", "Something isn't working"},
	{"Feat", "#a2eeef", "New feature or request"},
	{"WIP", "#fbca04", "Work in progress"},
}

// ModelToLabelInfo 将模型转换为标签响应
func ModelToLabelInfo(l *models.Label) LabelInfo {
	return LabelInfo{
		ID:          l.ID,
		Name:        l.Name,
		Color:       l.Color,
		Description: l.Description,
	}
}

// GetIssueLabels 查询单个 Issue 的标签列表
func GetIssueLabels(db *models.Database, issueID int64) []LabelInfo {
	issueLabels, err := db.IssueLabel.Select().Filter(
		goent.Equals(db.IssueLabel.Field("issue_id"), issueID),
	).All()
	if err != nil {
		return []LabelInfo{}
	}

	var labelIDs []int64
	for _, il := range issueLabels {
		labelIDs = append(labelIDs, il.LabelID)
	}

	if len(labelIDs) == 0 {
		return []LabelInfo{}
	}

	labels, err := db.Label.Select().Filter(
		goent.In(db.Label.Field("id"), labelIDs),
	).All()
	if err != nil {
		return []LabelInfo{}
	}

	var result []LabelInfo
	for _, l := range labels {
		result = append(result, ModelToLabelInfo(l))
	}
	return result
}

// BatchGetIssueLabels 批量查询多个 Issue 的标签，返回 issueID -> []LabelInfo 映射
func BatchGetIssueLabels(db *models.Database, issueIDs []int64) map[int64][]LabelInfo {
	if len(issueIDs) == 0 {
		return map[int64][]LabelInfo{}
	}

	issueLabels, err := db.IssueLabel.Select().Filter(
		goent.In(db.IssueLabel.Field("issue_id"), issueIDs),
	).All()
	if err != nil {
		return map[int64][]LabelInfo{}
	}

	var labelIDs []int64
	for _, il := range issueLabels {
		labelIDs = append(labelIDs, il.LabelID)
	}

	labelMap := make(map[int64]*models.Label)
	if len(labelIDs) > 0 {
		labels, err := db.Label.Select().Filter(
			goent.In(db.Label.Field("id"), labelIDs),
		).All()
		if err == nil {
			for _, l := range labels {
				labelMap[l.ID] = l
			}
		}
	}

	result := make(map[int64][]LabelInfo)
	for _, il := range issueLabels {
		l, ok := labelMap[il.LabelID]
		if !ok {
			continue
		}
		result[il.IssueID] = append(result[il.IssueID], ModelToLabelInfo(l))
	}
	return result
}

// EnsureDefaultLabels 确保仓库拥有默认标签，不存在则创建
func EnsureDefaultLabels(db *models.Database, repoID int64) error {
	for _, dl := range DefaultLabels {
		count, _ := db.Label.Select().Filter(
			goent.And(
				goent.Equals(db.Label.Field("repository_id"), repoID),
				goent.Equals(db.Label.Field("name"), dl.Name),
			),
		).Count("id")
		if count == 0 {
			newLabel := &models.Label{
				Name:         dl.Name,
				Color:        dl.Color,
				Description:  dl.Description,
				RepositoryID: repoID,
			}
			if err := db.Label.Insert().One(newLabel); err != nil {
				return err
			}
		}
	}
	return nil
}

// AttachLabelsToIssue 将标签名列表关联到指定 Issue，返回关联的标签信息
func AttachLabelsToIssue(db *models.Database, repoID, issueID int64, labelNames []string) []LabelInfo {
	var labels []LabelInfo
	if len(labelNames) == 0 {
		return labels
	}

	dbLabels, err := db.Label.Select().Filter(
		goent.And(
			goent.Equals(db.Label.Field("repository_id"), repoID),
			goent.In(db.Label.Field("name"), labelNames),
		),
	).All()
	if err != nil {
		return labels
	}

	for _, l := range dbLabels {
		db.IssueLabel.Insert().One(&models.IssueLabel{
			IssueID: issueID,
			LabelID: l.ID,
		})
		labels = append(labels, ModelToLabelInfo(l))
	}
	return labels
}

// ReplaceIssueLabels 替换 Issue 的所有标签关联
func ReplaceIssueLabels(db *models.Database, repoID, issueID int64, labelNames []string) []LabelInfo {
	db.IssueLabel.Delete().Filter(
		goent.Equals(db.IssueLabel.Field("issue_id"), issueID),
	).Exec()
	return AttachLabelsToIssue(db, repoID, issueID, labelNames)
}
