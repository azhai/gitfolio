package seed

import (
	"log"

	"github.com/azhai/gitfolio/models"
)

func SeedRepos() {
	db := models.GetDB()
	repos := []struct {
		Owner       string
		Name        string
		Description string
		Homepage    string
		Readme      string
		IsPrivate   bool
		StarsCount  int
		ForksCount  int
		WatchCount  int
	}{
		{
			Owner:       "ryan",
			Name:        "gx",
			Description: "A fast file search and batch rename tool written in Go",
			Homepage:    "https://github.com/ryan/gx",
			Readme: `# gx

用 Go 编写的快速文件搜索和批量重命名工具。

## 功能特性

### find: 快速文件内容搜索工具（灵感来自 ripgrep）

- 多线程搜索
- 支持正则表达式
- 彩色高亮输出
- 行号显示
- 通过 glob 模式过滤文件
- 二进制文件检测

### replace: 快速文件内容搜索和替换工具

- 多线程搜索和替换
- 支持正则表达式
- 干跑模式（执行前预览）

### rename: 批量文件重命名工具（灵感来自 f2）

- 正则表达式匹配
- 支持捕获组替换（$1, $2 等）
- 冲突检测

## 安装

` + "```" + `bash
go install github.com/ryan/gx@latest
` + "```" + `

## 许可证

MIT 许可证`,
			IsPrivate:  false,
			StarsCount: 42,
			ForksCount: 8,
			WatchCount: 12,
		},
		{
			Owner:       "xorm",
			Name:        "builder",
			Description: "Lightweight and fast SQL builder for Go and XORM",
			Homepage:    "https://xorm.io/builder",
			Readme: `# Builder

Lightweight and fast SQL builder for Go and XORM.

## Install

` + "```" + `bash
go get xorm.io/builder
` + "```" + `

## Usage

### Select

` + "```" + `go
// SELECT * FROM user WHERE name = 'slene'
sql, args, err := builder.Select("*").From("user").Where(builder.Eq{"name": "slene"}).ToSQL()
` + "```" + `

### Insert

` + "```" + `go
// INSERT INTO user (name, age) VALUES ('slene', 25)
sql, args, err := builder.Insert(builder.Eq{"name": "slene", "age": 25}).Into("user").ToSQL()
` + "```" + `

### Update

` + "```" + `go
// UPDATE user SET name = 'slene', age = 25 WHERE id = 1
sql, args, err := builder.Update(builder.Eq{"name": "slene", "age": 25}).From("user").Where(builder.Eq{"id": 1}).ToSQL()
` + "```" + `

### Delete

` + "```" + `go
// DELETE FROM user WHERE id = 1
sql, args, err := builder.Delete().From("user").Where(builder.Eq{"id": 1}).ToSQL()
` + "```" + `

## Conditions

### Eq

` + "```" + `go
builder.Eq{"a": 1}.ToSQL()
// a = 1

builder.Eq{"a": 1, "b": 2}.ToSQL()
// a = 1 AND b = 2

builder.Eq{"a": []int{1, 2, 3}}.ToSQL()
// a IN (1, 2, 3)
` + "```" + `

### Neq

` + "```" + `go
builder.Neq{"a": 1}.ToSQL()
// a <> 1

builder.Neq{"a": []int{1, 2, 3}}.ToSQL()
// a NOT IN (1, 2, 3)
` + "```" + `

### Gt, Gte, Lt, Lte

` + "```" + `go
builder.Gt{"a": 1}.ToSQL()  // a > 1
builder.Gte{"a": 1}.ToSQL() // a >= 1
builder.Lt{"a": 1}.ToSQL()  // a < 1
builder.Lte{"a": 1}.ToSQL() // a <= 1
` + "```" + `

### Like

` + "```" + `go
builder.Like{"a": "%test%"}.ToSQL()
// a LIKE '%test%'
` + "```" + `

### Expr

` + "```" + `go
builder.Expr("a = ? AND b = ?", 1, 2).ToSQL()
// a = 1 AND b = 2
` + "```" + `

### In

` + "```" + `go
builder.In("a", 1, 2, 3).ToSQL()
// a IN (1, 2, 3)
` + "```" + `

### NotIn

` + "```" + `go
builder.NotIn("a", 1, 2, 3).ToSQL()
// a NOT IN (1, 2, 3)
` + "```" + `

### IsNull

` + "```" + `go
builder.IsNull{"a"}.ToSQL()
// a IS NULL
` + "```" + `

### NotIsNull

` + "```" + `go
builder.NotNull{"a"}.ToSQL()
// a IS NOT NULL
` + "```" + `

## License

MIT License`,
			IsPrivate:  false,
			StarsCount: 89,
			ForksCount: 45,
			WatchCount: 12,
		},
	}

	repoMap := make(map[string]*models.Repository)
	for _, repoData := range repos {
		owner, err := db.User.Select().Where("username = ?", repoData.Owner).One()
		if err != nil {
			log.Printf("Owner %s not found", repoData.Owner)
			continue
		}

		repo := &models.Repository{
			Name:          repoData.Name,
			Description:   repoData.Description,
			Homepage:      repoData.Homepage,
			Readme:        repoData.Readme,
			OwnerID:       owner.ID,
			IsPrivate:     repoData.IsPrivate,
			DefaultBranch: "main",
		}

		err = db.Repository.Insert().One(repo)
		if err != nil {
			log.Printf("Failed to create repository %s: %v", repoData.Name, err)
		} else {
			log.Printf("Created repository: %s/%s", repoData.Owner, repoData.Name)
			repoMap[repoData.Owner+"/"+repoData.Name] = repo

			repoStats := &models.RepositoryStats{
				RepositoryID: repo.ID,
				StarsCount:   repoData.StarsCount,
				ForksCount:   repoData.ForksCount,
				WatchCount:   repoData.WatchCount,
			}
			if err := db.RepositoryStats.Insert().One(repoStats); err != nil {
				log.Printf("Failed to create repository stats: %v", err)
			}
		}
	}

	issues := []struct {
		Repo     string
		Title    string
		Body     string
		Author   string
		IsClosed bool
	}{
		{
			Repo:     "ryan/gx",
			Title:    "Add support for binary file content preview",
			Body:     "It would be helpful to have a preview mode for binary files that shows metadata instead of trying to display raw content",
			Author:   "xorm",
			IsClosed: false,
		},
		{
			Repo:     "ryan/gx",
			Title:    "Improve glob pattern performance",
			Body:     "Current glob pattern matching could be optimized for large directories with many files",
			Author:   "xorm",
			IsClosed: true,
		},
		{
			Repo:     "xorm/builder",
			Title:    "Add support for CTE (Common Table Expressions)",
			Body:     "Implement WITH clause support for complex queries",
			Author:   "ryan",
			IsClosed: false,
		},
		{
			Repo:     "xorm/builder",
			Title:    "Add support for window functions",
			Body:     "Implement OVER clause for window functions like ROW_NUMBER, RANK, etc.",
			Author:   "ryan",
			IsClosed: false,
		},
	}

	for i, issueData := range issues {
		repo := repoMap[issueData.Repo]
		if repo == nil {
			continue
		}

		author, err := db.User.Select().Where("username = ?", issueData.Author).One()
		if err != nil {
			continue
		}

		issue := &models.Issue{
			Title:        issueData.Title,
			Body:         issueData.Body,
			RepositoryID: repo.ID,
			AuthorID:     author.ID,
			Number:       i + 1,
			IsClosed:     issueData.IsClosed,
		}

		err = db.Issue.Insert().One(issue)
		if err != nil {
			log.Printf("Failed to create issue: %v", err)
		} else {
			log.Printf("Created issue #%d: %s", issue.Number, issue.Title)
		}
	}

	mrs := []struct {
		Repo         string
		Title        string
		Body         string
		Author       string
		SourceBranch string
		TargetBranch string
		IsMerged     bool
		IsClosed     bool
	}{
		{
			Repo:         "ryan/gx",
			Title:        "Add regex capture group support for rename",
			Body:         "Implement $1, $2 etc. capture group replacements in rename command",
			Author:       "xorm",
			SourceBranch: "feature/capture-groups",
			TargetBranch: "main",
			IsMerged:     false,
			IsClosed:     false,
		},
		{
			Repo:         "ryan/gx",
			Title:        "Add dry-run mode for replace",
			Body:         "Preview changes before executing search and replace operations",
			Author:       "xorm",
			SourceBranch: "feature/dry-run",
			TargetBranch: "main",
			IsMerged:     true,
			IsClosed:     true,
		},
		{
			Repo:         "xorm/builder",
			Title:        "Add subquery support",
			Body:         "Implement subquery in FROM clause and WHERE conditions",
			Author:       "ryan",
			SourceBranch: "feature/subquery",
			TargetBranch: "main",
			IsMerged:     true,
			IsClosed:     true,
		},
		{
			Repo:         "xorm/builder",
			Title:        "Add UNION and UNION ALL support",
			Body:         "Implement UNION and UNION ALL operations for combining query results",
			Author:       "ryan",
			SourceBranch: "feature/union",
			TargetBranch: "main",
			IsMerged:     false,
			IsClosed:     false,
		},
	}

	for i, mrData := range mrs {
		repo := repoMap[mrData.Repo]
		if repo == nil {
			continue
		}

		author, err := db.User.Select().Where("username = ?", mrData.Author).One()
		if err != nil {
			continue
		}

		mr := &models.PullRequest{
			Title:        mrData.Title,
			Body:         mrData.Body,
			RepositoryID: repo.ID,
			AuthorID:     author.ID,
			Number:       i + 1,
			SourceBranch: mrData.SourceBranch,
			TargetBranch: mrData.TargetBranch,
			IsMerged:     mrData.IsMerged,
			IsClosed:     mrData.IsClosed,
			Status:       "open",
		}

		if mrData.IsMerged {
			mr.Status = "merged"
		} else if mrData.IsClosed {
			mr.Status = "closed"
		}

		err = db.PullRequest.Insert().One(mr)
		if err != nil {
			log.Printf("Failed to create pull request: %v", err)
		} else {
			log.Printf("Created pull request #%d: %s", mr.Number, mr.Title)
		}
	}

	log.Println("Database seeding completed!")
}
