package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/azhai/gitfolio/models"
	"github.com/shurcooL/githubv4"
	"golang.org/x/oauth2"
)

// ============================================================================
// GraphQL 客户端与查询结构定义
//
// 同步策略（updatedAt DESC 倒序读取，不追求全量同步）：
//   - 首次同步（since == nil）：读取最近 365 天或 20 页数据，取范围更大者。
//     即持续翻页直到同时超出 365 天和 20 页两个限制。
//   - 增量同步（since != nil）：从上次同步点往前推 30 天作为窗口起点，
//     只读取 [since-30d, now] 范围内的数据。
//   - 删除检测：同步窗口内本地存在但远程未见的记录，标记为 hidden。
//   - 评论与标签作为嵌套字段一次性获取，避免 N+1 请求。
//   - GraphQL 的 issues 连接不包含 PR，无需 skippedAsPR 过滤。
// ============================================================================

// graphqlInt64 接收 GraphQL Int 字段，但用 int64 存储以避免溢出。
// GitHub 的 DatabaseID 字段虽声明为 Int（int32），但实际返回值可能超过 int32 范围。
// 响应字段类型名不影响查询构造，仅用于 JSON 反序列化。
type graphqlInt64 int64

// UnmarshalJSON 实现 json.Unmarshaler，用 int64 解析避免溢出。
func (v *graphqlInt64) UnmarshalJSON(data []byte) error {
	var n int64
	if err := json.Unmarshal(data, &n); err != nil {
		return err
	}
	*v = graphqlInt64(n)
	return nil
}

// newGitHubGraphQLClient 创建 GitHub GraphQL v4 客户端。
func newGitHubGraphQLClient(token string) *githubv4.Client {
	if token == "" {
		return githubv4.NewClient(NewHTTPClient(60 * time.Second))
	}
	src := oauth2.StaticTokenSource(&oauth2.Token{AccessToken: token})
	httpClient := oauth2.NewClient(context.Background(), src)
	return githubv4.NewClient(httpClient)
}

// graphqlPageInfo 对应 GraphQL 的 PageInfo。
type graphqlPageInfo struct {
	EndCursor   githubv4.String
	HasNextPage githubv4.Boolean
}

// graphqlLabel 对应 GraphQL 的 Label。
type graphqlLabel struct {
	ID          githubv4.ID
	Name        githubv4.String
	Color       githubv4.String
	Description githubv4.String
}

// graphqlIssueComment 对应 Issue/PR 的评论。
type graphqlIssueComment struct {
	DatabaseID graphqlInt64
	Body       githubv4.String
	Author     struct {
		Login githubv4.String
	}
	CreatedAt githubv4.DateTime
	UpdatedAt githubv4.DateTime
}

// graphqlIssue 对应 GraphQL Issue 节点。
type graphqlIssue struct {
	DatabaseID graphqlInt64
	Number     githubv4.Int
	Title      githubv4.String
	Body       githubv4.String
	State      githubv4.String
	Author     struct {
		Login githubv4.String
	}
	CreatedAt githubv4.DateTime
	UpdatedAt githubv4.DateTime
	ClosedAt  githubv4.DateTime
	Labels    struct {
		Nodes []graphqlLabel
	} `graphql:"labels(first: 50)"`
	Comments struct {
		TotalCount githubv4.Int
		Nodes      []graphqlIssueComment
	} `graphql:"comments(first: 100)"`
}

// graphqlPullRequest 对应 GraphQL PullRequest 节点。
type graphqlPullRequest struct {
	DatabaseID graphqlInt64
	Number     githubv4.Int
	Title      githubv4.String
	Body       githubv4.String
	State      githubv4.String
	Author     struct {
		Login githubv4.String
	}
	CreatedAt   githubv4.DateTime
	UpdatedAt   githubv4.DateTime
	ClosedAt    githubv4.DateTime
	MergedAt    githubv4.DateTime
	HeadRefName githubv4.String
	BaseRefName githubv4.String
	Labels      struct {
		Nodes []graphqlLabel
	} `graphql:"labels(first: 50)"`
	Comments struct {
		TotalCount githubv4.Int
		Nodes      []graphqlIssueComment
	} `graphql:"comments(first: 100)"`
}

// issuesQuery 查询仓库的 Issues。
type issuesQuery struct {
	Repository struct {
		Issues struct {
			TotalCount githubv4.Int
			PageInfo   graphqlPageInfo
			Nodes      []graphqlIssue
		} `graphql:"issues(first: $first, after: $after, orderBy: $orderBy, states: $states)"`
	} `graphql:"repository(owner: $owner, name: $name)"`
}

// pullRequestsQuery 查询仓库的 Pull Requests。
type pullRequestsQuery struct {
	Repository struct {
		PullRequests struct {
			TotalCount githubv4.Int
			PageInfo   graphqlPageInfo
			Nodes      []graphqlPullRequest
		} `graphql:"pullRequests(first: $first, after: $after, orderBy: $orderBy, states: $states)"`
	} `graphql:"repository(owner: $owner, name: $name)"`
}

// graphqlProgressSaver 进度保存回调。
type graphqlProgressSaver func(number int, updatedAt *time.Time) error

// ============================================================================
// Issue 同步
// ============================================================================

// SyncGitHubIssuesGraphQL 使用 GraphQL API 同步 Issues。
//
// 同步策略（updatedAt DESC 倒序）：
//   - since == nil（首次）：读取最近 365 天或 20 页数据，取范围更大者。
//   - since != nil（增量）：窗口起点为 since-30d，只读 [since-30d, now] 范围。
//   - 窗口内本地存在但远程未见的记录标记为 hidden（删除检测）。
func (s *SyncService) SyncGitHubIssuesGraphQL(ctx context.Context, repoID int64, owner, repo, token string, since *time.Time, lastNumber int, saveProgress graphqlProgressSaver) (SyncResult, error) {
	result := SyncResult{}
	client := newGitHubGraphQLClient(token)
	now := time.Now()

	firstSync := since == nil

	// 计算同步窗口起点与页数上限
	var windowStart time.Time
	var maxPages int // 0 表示无页数限制
	if firstSync {
		// 首次同步：365 天或 20 页，取范围更大者（即同时超出两个限制才停止）
		windowStart = now.Add(-365 * 24 * time.Hour)
		maxPages = 20
	} else {
		// 增量同步：从上次同步点往前推 30 天
		windowStart = since.Add(-30 * 24 * time.Hour)
	}

	// 加载已存在 Issue 用于去重与 upsert
	existingIssueMap := make(map[int]*models.Issue)
	existingIssues, _ := s.db.Issue.Select().Where("repository_id = ?", repoID).All()
	for _, issue := range existingIssues {
		existingIssueMap[issue.Number] = issue
	}

	// 始终使用 updatedAt DESC
	var orderBy githubv4.IssueOrder
	orderBy.Field = githubv4.IssueOrderFieldUpdatedAt
	orderBy.Direction = githubv4.OrderDirectionDesc

	vars := map[string]any{
		"owner":   githubv4.String(owner),
		"name":    githubv4.String(repo),
		"first":   githubv4.Int(100),
		"after":   (*githubv4.String)(nil),
		"orderBy": orderBy,
		"states":  (*[]githubv4.IssueState)(nil), // nil 表示所有状态
	}

	// 跟踪远程已见的 number（用于删除检测）
	remoteSeen := make(map[int]bool)
	pageNum := 0
	for {
		pageStart := time.Now()
		var q issuesQuery
		if err := client.Query(ctx, &q, vars); err != nil {
			return result, fmt.Errorf("graphql issues query: %w", err)
		}
		apiDur := time.Since(pageStart)

		nodes := q.Repository.Issues.Nodes
		if len(nodes) == 0 {
			break
		}

		// 第一遍：过滤 + 分类
		type issueNode struct {
			node     graphqlIssue
			existing *models.Issue
		}
		var toInsert []issueNode
		var toUpdate []issueNode
		skipped, upToDate := 0, 0
		stopSync := false

		for _, node := range nodes {
			number := int(node.Number)
			updatedAt := node.UpdatedAt.Time

			// 增量同步：遇到早于窗口起点的记录，停止（DESC 后续更旧）
			if !firstSync && updatedAt.Before(windowStart) {
				stopSync = true
				break
			}

			remoteSeen[number] = true

			if number > result.MaxIssueNumber {
				result.MaxIssueNumber = number
			}
			if result.MaxIssueUpdatedAt == nil || updatedAt.After(*result.MaxIssueUpdatedAt) {
				t := updatedAt
				result.MaxIssueUpdatedAt = &t
			}

			if existing, ok := existingIssueMap[number]; ok {
				if !existing.UpdatedAt.Before(updatedAt) {
					upToDate++
					continue
				}
				toUpdate = append(toUpdate, issueNode{node: node, existing: existing})
			} else {
				toInsert = append(toInsert, issueNode{node: node})
			}
		}

		// 执行插入
		dbStart := time.Now()
		inserted := 0
		for _, item := range toInsert {
			node := item.node
			state := "open"
			if string(node.State) == "CLOSED" {
				state = "closed"
			}
			issue := &models.Issue{
				Title:         string(node.Title),
				Body:          string(node.Body),
				Number:        int(node.Number),
				RepositoryID:  repoID,
				AuthorName:    string(node.Author.Login),
				IsClosed:      string(node.State) == "CLOSED",
				Status:        state,
				CommentsCount: int(node.Comments.TotalCount),
				CreatedAt:     node.CreatedAt.Time,
				UpdatedAt:     node.UpdatedAt.Time,
			}
			if err := s.db.Issue.Insert().One(issue); err != nil {
				s.warnf("failed to insert Issue #%d: %v", issue.Number, err)
				continue
			}
			inserted++
			result.IssuesInserted++
			existingIssueMap[issue.Number] = issue
		}

		// 执行更新
		updated := 0
		for _, item := range toUpdate {
			node := item.node
			issue := item.existing
			issue.Title = string(node.Title)
			issue.Body = string(node.Body)
			issue.AuthorName = string(node.Author.Login)
			issue.IsClosed = string(node.State) == "CLOSED"
			// 如果之前被标记为 hidden，但远程又出现了，恢复为 open/closed
			if issue.Status == "hidden" {
				if string(node.State) == "CLOSED" {
					issue.Status = "closed"
				} else {
					issue.Status = "open"
				}
			}
			issue.CommentsCount = int(node.Comments.TotalCount)
			issue.UpdatedAt = node.UpdatedAt.Time
			if err := s.db.Issue.Save().One(issue); err != nil {
				s.warnf("failed to update Issue #%d: %v", issue.Number, err)
				continue
			}
			updated++
			result.IssuesUpdated++
		}
		dbDur := time.Since(dbStart)

		// 第二遍：构建标签链接和评论任务（此时所有 issue.ID 已就绪）
		labelsStart := time.Now()
		var labelLinks []struct {
			issueID int64
			labels  []GitHubLabel
		}
		type commentTask struct {
			issueID  int64
			comments []graphqlIssueComment
		}
		var commentTasks []commentTask

		for _, node := range nodes {
			number := int(node.Number)
			issue, ok := existingIssueMap[number]
			if !ok {
				continue
			}

			// 标签
			if len(node.Labels.Nodes) > 0 {
				labelLinks = append(labelLinks, struct {
					issueID int64
					labels  []GitHubLabel
				}{issue.ID, graphqlLabelsToGitHubLabels(node.Labels.Nodes)})
			}

			// 评论（仅当评论数 > 0 且与本地不同时）
			if int(node.Comments.TotalCount) > 0 && int(node.Comments.TotalCount) != issue.CommentsCount {
				commentTasks = append(commentTasks, commentTask{issue.ID, node.Comments.Nodes})
			} else if int(node.Comments.TotalCount) > 0 && issue.CommentsCount == 0 {
				// 新插入的 issue，需要同步评论
				commentTasks = append(commentTasks, commentTask{issue.ID, node.Comments.Nodes})
			}
		}

		s.batchSyncIssueLabels(repoID, labelLinks)
		labelsDur := time.Since(labelsStart)

		// 处理评论
		commentsDur := time.Duration(0)
		if len(commentTasks) > 0 {
			commentsStart := time.Now()
			var allCommentsToInsert []*models.Comment
			var allCommentsToUpdate []*models.Comment
			for _, task := range commentTasks {
				if len(task.comments) == 0 {
					continue
				}
				ghComments := graphqlCommentsToGitHubComments(task.comments)
				inserts, updates := s.prepareIssueComments(repoID, task.issueID, ghComments)
				allCommentsToInsert = append(allCommentsToInsert, inserts...)
				allCommentsToUpdate = append(allCommentsToUpdate, updates...)
			}
			s.batchSaveComments(allCommentsToInsert, allCommentsToUpdate)
			commentsDur = time.Since(commentsStart)
		}

		pageNum++
		s.emit(SyncTopicProgress, map[string]any{
			"message":  fmt.Sprintf("Issue GraphQL page %d done (inserted=%d updated=%d)", pageNum, result.IssuesInserted, result.IssuesUpdated),
			"page":     pageNum,
			"inserted": result.IssuesInserted,
			"updated":  result.IssuesUpdated,
		})

		log.Printf("[DEBUG-graphql] issue page %d stats: fetched=%d skipped=%d up_to_date=%d inserted=%d updated=%d",
			pageNum, len(nodes), skipped, upToDate, inserted, updated)
		log.Printf("[DEBUG-graphql] issue page %d timing: total=%v api=%v db=%v labels=%v comments=%v",
			pageNum, time.Since(pageStart), apiDur, dbDur, labelsDur, commentsDur)

		// 每 10 页保存一次进度
		if saveProgress != nil && pageNum%10 == 0 && result.MaxIssueUpdatedAt != nil {
			if err := saveProgress(result.MaxIssueNumber, result.MaxIssueUpdatedAt); err != nil {
				s.warnf("failed to save issue progress at page %d: %v", pageNum, err)
			}
		}

		// 首次同步：达到页数上限且超出 365 天窗口才停止
		// 增量同步：stopSync（遇到早于窗口起点的记录）
		pagesExceeded := firstSync && maxPages > 0 && pageNum+1 >= maxPages
		timeExceeded := firstSync && len(nodes) > 0 && nodes[len(nodes)-1].UpdatedAt.Time.Before(windowStart)
		if stopSync || pagesExceeded && timeExceeded || !bool(q.Repository.Issues.PageInfo.HasNextPage) {
			break
		}
		vars["after"] = githubv4.NewString(q.Repository.Issues.PageInfo.EndCursor)
	}

	// 删除检测：同步窗口内本地存在但远程未见的记录标记为 hidden。
	// 仅检查 updatedAt >= windowStart 的本地记录（窗口范围内）。
	for number, issue := range existingIssueMap {
		if issue.Status == "hidden" {
			continue
		}
		if issue.UpdatedAt.Before(windowStart) {
			continue // 不在本次窗口范围内，跳过
		}
		if !remoteSeen[number] {
			issue.Status = "hidden"
			if err := s.db.Issue.Save().One(issue); err != nil {
				s.warnf("failed to mark Issue #%d as hidden: %v", number, err)
			} else {
				result.IssuesDeleted++
			}
		}
	}

	return result, nil
}

// ============================================================================
// PR 同步
// ============================================================================

// SyncGitHubPRsGraphQL 使用 GraphQL API 同步 Pull Requests。
// 策略与 Issue 一致（updatedAt DESC 倒序）。
func (s *SyncService) SyncGitHubPRsGraphQL(ctx context.Context, repoID int64, owner, repo, token string, since *time.Time, lastNumber int, saveProgress graphqlProgressSaver) (SyncResult, error) {
	result := SyncResult{}
	client := newGitHubGraphQLClient(token)
	now := time.Now()

	firstSync := since == nil

	// 计算同步窗口起点与页数上限
	var windowStart time.Time
	var maxPages int // 0 表示无页数限制
	if firstSync {
		windowStart = now.Add(-365 * 24 * time.Hour)
		maxPages = 20
	} else {
		windowStart = since.Add(-30 * 24 * time.Hour)
	}

	existingPRMap := make(map[int]*models.PullRequest)
	existingPRs, _ := s.db.PullRequest.Select().Where("repository_id = ?", repoID).All()
	for _, pr := range existingPRs {
		existingPRMap[pr.Number] = pr
	}

	// 始终使用 updatedAt DESC
	var orderBy githubv4.IssueOrder
	orderBy.Field = githubv4.IssueOrderFieldUpdatedAt
	orderBy.Direction = githubv4.OrderDirectionDesc

	vars := map[string]any{
		"owner":   githubv4.String(owner),
		"name":    githubv4.String(repo),
		"first":   githubv4.Int(100),
		"after":   (*githubv4.String)(nil),
		"orderBy": orderBy,
		"states":  (*[]githubv4.PullRequestState)(nil),
	}

	// 跟踪远程已见的 number（用于删除检测）
	remoteSeen := make(map[int]bool)
	pageNum := 0
	for {
		pageStart := time.Now()
		var q pullRequestsQuery
		if err := client.Query(ctx, &q, vars); err != nil {
			return result, fmt.Errorf("graphql pull requests query: %w", err)
		}
		apiDur := time.Since(pageStart)

		nodes := q.Repository.PullRequests.Nodes
		if len(nodes) == 0 {
			break
		}

		// 第一遍：过滤 + 分类
		type prNode struct {
			node     graphqlPullRequest
			existing *models.PullRequest
		}
		var toInsert []prNode
		var toUpdate []prNode
		skipped, upToDate := 0, 0
		stopSync := false

		for _, node := range nodes {
			number := int(node.Number)
			updatedAt := node.UpdatedAt.Time

			// 增量同步：遇到早于窗口起点的记录，停止（DESC 后续更旧）
			if !firstSync && updatedAt.Before(windowStart) {
				stopSync = true
				break
			}

			remoteSeen[number] = true

			if number > result.MaxPRNumber {
				result.MaxPRNumber = number
			}
			if result.MaxPRUpdatedAt == nil || updatedAt.After(*result.MaxPRUpdatedAt) {
				t := updatedAt
				result.MaxPRUpdatedAt = &t
			}

			if existing, ok := existingPRMap[number]; ok {
				if !existing.UpdatedAt.Before(updatedAt) {
					upToDate++
					continue
				}
				toUpdate = append(toUpdate, prNode{node: node, existing: existing})
			} else {
				toInsert = append(toInsert, prNode{node: node})
			}
		}

		// 执行插入
		dbStart := time.Now()
		inserted := 0
		for _, item := range toInsert {
			node := item.node
			isMerged := !node.MergedAt.Time.IsZero()
			status := "open"
			if string(node.State) == "CLOSED" {
				status = "closed"
			}
			pr := &models.PullRequest{
				Title:         string(node.Title),
				Body:          string(node.Body),
				Number:        int(node.Number),
				RepositoryID:  repoID,
				AuthorName:    string(node.Author.Login),
				SourceBranch:  string(node.HeadRefName),
				TargetBranch:  string(node.BaseRefName),
				Status:        status,
				IsMerged:      isMerged,
				IsClosed:      string(node.State) == "CLOSED",
				CommentsCount: int(node.Comments.TotalCount),
				CreatedAt:     node.CreatedAt.Time,
				UpdatedAt:     node.UpdatedAt.Time,
			}
			if err := s.db.PullRequest.Insert().One(pr); err != nil {
				s.warnf("failed to insert PR #%d: %v", pr.Number, err)
				continue
			}
			inserted++
			result.PRsInserted++
			existingPRMap[pr.Number] = pr
		}

		// 执行更新
		updated := 0
		for _, item := range toUpdate {
			node := item.node
			pr := item.existing
			isMerged := !node.MergedAt.Time.IsZero()
			status := "open"
			if string(node.State) == "CLOSED" {
				status = "closed"
			}
			pr.Title = string(node.Title)
			pr.Body = string(node.Body)
			pr.AuthorName = string(node.Author.Login)
			pr.SourceBranch = string(node.HeadRefName)
			pr.TargetBranch = string(node.BaseRefName)
			// 远程存在即恢复（如果之前被标记为 hidden，现在远程又出现了，恢复为 open/closed）
			pr.Status = status
			pr.IsMerged = isMerged
			pr.IsClosed = string(node.State) == "CLOSED"
			pr.CommentsCount = int(node.Comments.TotalCount)
			pr.UpdatedAt = node.UpdatedAt.Time
			if err := s.db.PullRequest.Save().One(pr); err != nil {
				s.warnf("failed to update PR #%d: %v", pr.Number, err)
				continue
			}
			updated++
			result.PRsUpdated++
		}
		dbDur := time.Since(dbStart)

		// 第二遍：构建标签链接和评论任务
		labelsStart := time.Now()
		var labelLinks []struct {
			prID   int64
			labels []GitHubLabel
		}
		type commentTask struct {
			prID     int64
			comments []graphqlIssueComment
		}
		var commentTasks []commentTask

		for _, node := range nodes {
			number := int(node.Number)
			pr, ok := existingPRMap[number]
			if !ok {
				continue
			}

			if len(node.Labels.Nodes) > 0 {
				labelLinks = append(labelLinks, struct {
					prID   int64
					labels []GitHubLabel
				}{pr.ID, graphqlLabelsToGitHubLabels(node.Labels.Nodes)})
			}

			if int(node.Comments.TotalCount) > 0 && int(node.Comments.TotalCount) != pr.CommentsCount {
				commentTasks = append(commentTasks, commentTask{pr.ID, node.Comments.Nodes})
			} else if int(node.Comments.TotalCount) > 0 && pr.CommentsCount == 0 {
				commentTasks = append(commentTasks, commentTask{pr.ID, node.Comments.Nodes})
			}
		}

		s.batchSyncPRLabels(repoID, labelLinks)
		labelsDur := time.Since(labelsStart)

		commentsDur := time.Duration(0)
		if len(commentTasks) > 0 {
			commentsStart := time.Now()
			var allCommentsToInsert []*models.Comment
			var allCommentsToUpdate []*models.Comment
			for _, task := range commentTasks {
				if len(task.comments) == 0 {
					continue
				}
				ghComments := graphqlCommentsToGitHubComments(task.comments)
				inserts, updates := s.preparePRComments(repoID, task.prID, ghComments)
				allCommentsToInsert = append(allCommentsToInsert, inserts...)
				allCommentsToUpdate = append(allCommentsToUpdate, updates...)
			}
			s.batchSaveComments(allCommentsToInsert, allCommentsToUpdate)
			commentsDur = time.Since(commentsStart)
		}

		pageNum++
		s.emit(SyncTopicProgress, map[string]any{
			"message":  fmt.Sprintf("PR GraphQL page %d done (inserted=%d updated=%d)", pageNum, result.PRsInserted, result.PRsUpdated),
			"page":     pageNum,
			"inserted": result.PRsInserted,
			"updated":  result.PRsUpdated,
		})

		log.Printf("[DEBUG-graphql] PR page %d stats: fetched=%d skipped=%d up_to_date=%d inserted=%d updated=%d",
			pageNum, len(nodes), skipped, upToDate, inserted, updated)
		log.Printf("[DEBUG-graphql] PR page %d timing: total=%v api=%v db=%v labels=%v comments=%v",
			pageNum, time.Since(pageStart), apiDur, dbDur, labelsDur, commentsDur)

		if saveProgress != nil && pageNum%10 == 0 && result.MaxPRUpdatedAt != nil {
			if err := saveProgress(result.MaxPRNumber, result.MaxPRUpdatedAt); err != nil {
				s.warnf("failed to save PR progress at page %d: %v", pageNum, err)
			}
		}

		// 首次同步：达到页数上限且超出 365 天窗口才停止
		// 增量同步：stopSync（遇到早于窗口起点的记录）
		pagesExceeded := firstSync && maxPages > 0 && pageNum+1 >= maxPages
		timeExceeded := firstSync && len(nodes) > 0 && nodes[len(nodes)-1].UpdatedAt.Time.Before(windowStart)
		if stopSync || pagesExceeded && timeExceeded || !bool(q.Repository.PullRequests.PageInfo.HasNextPage) {
			break
		}
		vars["after"] = githubv4.NewString(q.Repository.PullRequests.PageInfo.EndCursor)
	}

	// 删除检测：同步窗口内本地存在但远程未见的记录标记为 hidden。
	// 仅检查 updatedAt >= windowStart 的本地记录（窗口范围内）。
	for number, pr := range existingPRMap {
		if pr.Status == "hidden" {
			continue
		}
		if pr.UpdatedAt.Before(windowStart) {
			continue // 不在本次窗口范围内，跳过
		}
		if !remoteSeen[number] {
			pr.Status = "hidden"
			if err := s.db.PullRequest.Save().One(pr); err != nil {
				s.warnf("failed to mark PR #%d as hidden: %v", number, err)
			} else {
				result.PRsDeleted++
			}
		}
	}

	return result, nil
}

// ============================================================================
// 辅助函数
// ============================================================================

func graphqlLabelsToGitHubLabels(nodes []graphqlLabel) []GitHubLabel {
	out := make([]GitHubLabel, 0, len(nodes))
	for _, n := range nodes {
		out = append(out, GitHubLabel{
			Name:        string(n.Name),
			Color:       string(n.Color),
			Description: string(n.Description),
		})
	}
	return out
}

func graphqlCommentsToGitHubComments(nodes []graphqlIssueComment) []GitHubComment {
	out := make([]GitHubComment, 0, len(nodes))
	for _, n := range nodes {
		out = append(out, GitHubComment{
			ID:        int64(n.DatabaseID),
			Body:      string(n.Body),
			User:      GitHubUser{Login: string(n.Author.Login)},
			CreatedAt: n.CreatedAt.Time,
			UpdatedAt: n.UpdatedAt.Time,
		})
	}
	return out
}
