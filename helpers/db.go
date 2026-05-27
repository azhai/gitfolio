package helpers

import (
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/goent"
)

// BatchGetContributors 批量查询贡献者，返回 ID -> Contributor 映射
func BatchGetContributors(db *models.Database, ids []int64) map[int64]*models.Contributor {
	result := make(map[int64]*models.Contributor)
	if len(ids) == 0 {
		return result
	}

	contributors, err := db.Contributor.Select().Filter(
		goent.In(db.Contributor.Field("id"), ids),
	).All()
	if err != nil {
		return result
	}

	for _, c := range contributors {
		result[c.ID] = c
	}
	return result
}

// BatchGetUsers 批量查询用户，返回 ID -> User 映射
func BatchGetUsers(db *models.Database, ids []int64) map[int64]*models.User {
	result := make(map[int64]*models.User)
	if len(ids) == 0 {
		return result
	}

	users, err := db.User.Select().Filter(
		goent.In(db.User.Field("id"), ids),
	).All()
	if err != nil {
		return result
	}

	for _, u := range users {
		result[u.ID] = u
	}
	return result
}

// BatchGetCommentsCount 批量统计评论数，返回关联 ID -> 数量映射
// entityType: "issue" 或 "pull_request"
func BatchGetCommentsCount(db *models.Database, entityIDs []int64, entityType string) map[int64]int {
	result := make(map[int64]int)
	if len(entityIDs) == 0 {
		return result
	}

	var fieldName string
	switch entityType {
	case "issue":
		fieldName = "issue_id"
	case "pull_request":
		fieldName = "pull_request_id"
	case "task":
		fieldName = "task_id"
	default:
		return result
	}

	comments, err := db.Comment.Select(fieldName).Filter(
		goent.In(db.Comment.Field(fieldName), entityIDs),
	).All()
	if err != nil {
		return result
	}

	for _, c := range comments {
		switch entityType {
		case "issue":
			if c.IssueID != nil {
				result[*c.IssueID]++
			}
		case "pull_request":
			if c.PullRequestID != nil {
				result[*c.PullRequestID]++
			}
		case "task":
			if c.TaskID != nil {
				result[*c.TaskID]++
			}
		}
	}
	return result
}

// CollectUniqueIDs 从多个 ID 切片中收集去重后的 ID 列表
func CollectUniqueIDs(idSlices ...[]int64) []int64 {
	seen := make(map[int64]bool)
	var result []int64
	for _, ids := range idSlices {
		for _, id := range ids {
			if id != 0 && !seen[id] {
				seen[id] = true
				result = append(result, id)
			}
		}
	}
	return result
}

// CollectContributorIDs 从 Issue 列表中收集所有贡献者 ID（作者 + 指派人）
func CollectContributorIDs(issues []*models.Issue) []int64 {
	var authorIDs, assigneeIDs []int64
	for _, issue := range issues {
		if issue.AuthorID != 0 {
			authorIDs = append(authorIDs, issue.AuthorID)
		}
		if issue.AssigneeID != nil && *issue.AssigneeID != 0 {
			assigneeIDs = append(assigneeIDs, *issue.AssigneeID)
		}
	}
	return CollectUniqueIDs(authorIDs, assigneeIDs)
}

// CollectPRContributorIDs 从 PR 列表中收集所有贡献者 ID（作者 + 指派人）
func CollectPRContributorIDs(prs []*models.PullRequest) []int64 {
	var authorIDs, assigneeIDs []int64
	for _, pr := range prs {
		if pr.AuthorID != 0 {
			authorIDs = append(authorIDs, pr.AuthorID)
		}
		if pr.AssigneeID != nil && *pr.AssigneeID != 0 {
			assigneeIDs = append(assigneeIDs, *pr.AssigneeID)
		}
	}
	return CollectUniqueIDs(authorIDs, assigneeIDs)
}

// CollectEntityIDs 从任意实体列表中提取 ID 列表
func CollectEntityIDs(getID func(int) int64, length int) []int64 {
	ids := make([]int64, length)
	for i := 0; i < length; i++ {
		ids[i] = getID(i)
	}
	return ids
}

// GetContributor 查询单个贡献者，未找到时返回占位贡献者
func GetContributor(db *models.Database, id int64) *models.Contributor {
	c, err := db.Contributor.Select().Where("id = ?", id).One()
	if err != nil || c == nil {
		return &models.Contributor{Name: "Unknown"}
	}
	return c
}

// GetUser 查询单个用户
func GetUser(db *models.Database, id int64) *models.User {
	u, err := db.User.Select().Where("id = ?", id).One()
	if err != nil {
		return nil
	}
	return u
}

// GetNextIssueNumber 获取仓库的下一个 Issue 编号
func GetNextIssueNumber(db *models.Database, repoID int64) int {
	issues, err := db.Issue.Select("number").Where("repository_id = ?", repoID).OrderBy("number DESC").Take(1).All()
	if err != nil || len(issues) == 0 {
		return 1
	}
	return issues[0].Number + 1
}

// GetNextPRNumber 获取仓库的下一个 PR 编号
func GetNextPRNumber(db *models.Database, repoID int64) int {
	prs, err := db.PullRequest.Select("number").Where("repository_id = ?", repoID).OrderBy("number DESC").Take(1).All()
	if err != nil || len(prs) == 0 {
		return 1
	}
	return prs[0].Number + 1
}

// FindOrCreateContributor 查找或创建贡献者记录
func FindOrCreateContributor(db *models.Database, repoID int64, name, email, avatar string) *models.Contributor {
	existing, _ := db.Contributor.Select().Filter(
		goent.And(
			goent.Equals(db.Contributor.Field("repository_id"), repoID),
			goent.Equals(db.Contributor.Field("name"), name),
		),
	).All()
	if len(existing) > 0 {
		return existing[0]
	}

	c := &models.Contributor{
		Name:         name,
		Email:        email,
		Avatar:       avatar,
		RepositoryID: repoID,
		CommitsCount: 0,
	}
	db.Contributor.Insert().One(c)
	return c
}

// BatchGetLabels 批量查询标签，返回 ID -> Label 映射
func BatchGetLabels(db *models.Database, ids []int64) map[int64]*models.Label {
	result := make(map[int64]*models.Label)
	if len(ids) == 0 {
		return result
	}

	labels, err := db.Label.Select().Filter(
		goent.In(db.Label.Field("id"), ids),
	).All()
	if err != nil {
		return result
	}

	for _, l := range labels {
		result[l.ID] = l
	}
	return result
}
