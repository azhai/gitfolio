package main

import (
	"log"
	"time"

	"github.com/azhai/gitfolio/models"
	"github.com/azhai/goent/utils"
)

func main() {
	env := utils.NewEnv()
	models.OpenDB(env)
	defer models.CloseDB()
	db := models.GetDB()

	log.Println("Inserting seed data...")

	// Create test user
	user := &models.User{
		Username: "testuser",
		Email:    "test@example.com",
		Avatar:   "https://avatars.githubusercontent.com/u/1?v=4",
	}
	err := db.User.Insert().One(user)
	if err != nil {
		log.Println("User already exists or error:", err)
		user, _ = db.User.Select().Where("username = ?", "testuser").One()
	} else {
		log.Println("Created user:", user.Username)
	}

	// Create groups
	groups := []*models.Group{
		{
			Name:        "golang",
			DisplayName: "Go语言社区",
			Description: "Go语言开发者社区，分享Go语言相关的项目和知识",
			Website:     "https://golang.org",
			Location:    "全球",
			OwnerID:     user.ID,
		},
		{
			Name:        "rust-lang",
			DisplayName: "Rust语言社区",
			Description: "Rust编程语言爱好者聚集地",
			Website:     "https://rust-lang.org",
			Location:    "全球",
			OwnerID:     user.ID,
		},
		{
			Name:        "frontend",
			DisplayName: "前端技术组",
			Description: "前端技术交流群，包括React、Vue、Angular等框架",
			Website:     "https://frontend.dev",
			Location:    "中国",
			OwnerID:     user.ID,
		},
	}

	for _, g := range groups {
		existing, _ := db.Group.Select().Where("name = ?", g.Name).One()
		if existing != nil {
			log.Println("Group already exists:", g.Name)
			continue
		}
		err = db.Group.Insert().One(g)
		if err != nil {
			log.Println("Group error:", err)
		} else {
			log.Println("Created group:", g.Name)
			member := &models.GroupMember{
				GroupID: g.ID,
				UserID:  user.ID,
				Role:    "owner",
			}
			db.GroupMember.Insert().One(member)
		}
	}

	// Create repository
	repo := &models.Repository{
		Name:        "test-repo",
		Description: "测试仓库，用于演示功能",
		Homepage:    "https://github.com/test/test-repo",
		OwnerID:     user.ID,
		IsPrivate:   false,
	}
	err = db.Repository.Insert().One(repo)
	if err != nil {
		log.Println("Repository already exists or error:", err)
		repo, _ = db.Repository.Select().Where("owner_id = ? AND name = ?", user.ID, "test-repo").One()
	} else {
		log.Println("Created repository:", repo.Name)
	}

	repoStats := &models.RepositoryStats{
		RepositoryID: repo.ID,
		StarsCount:   42,
		ForksCount:   10,
		WatchCount:   15,
	}
	db.RepositoryStats.Insert().One(repoStats)

	// Create mirror repository
	mirrorRepo := &models.Repository{
		Name:          "builder-mirror",
		Description:   "镜像项目：xorm/builder - SQL builder for Go",
		Homepage:      "https://gitea.com/xorm/builder",
		OwnerID:       user.ID,
		IsPrivate:     false,
		IsMirror:      true,
		ProjectType:   string(models.ProjectTypeMirror),
		MirrorURL:     "https://gitea.com/xorm/builder.git",
		LocalPath:     "./repos/builder-mirror.git",
		DefaultBranch: "master",
	}
	err = db.Repository.Insert().One(mirrorRepo)
	if err != nil {
		log.Println("Mirror repository already exists or error:", err)
		mirrorRepo, _ = db.Repository.Select().Where("owner_id = ? AND name = ?", user.ID, "builder-mirror").One()
	} else {
		log.Println("Created mirror repository:", mirrorRepo.Name)
	}

	mirrorStats := &models.RepositoryStats{
		RepositoryID: mirrorRepo.ID,
		StarsCount:   128,
		ForksCount:   32,
		WatchCount:   45,
	}
	db.RepositoryStats.Insert().One(mirrorStats)

	// Create activities
	now := time.Now()
	activities := []*models.Activity{
		{
			UserID:       &user.ID,
			RepositoryID: &repo.ID,
			ActivityType: "create_repo",
			Title:        "创建了仓库",
			Content:      "test-repo",
			CreatedAt:    now.Add(-2 * time.Hour),
		},
		{
			UserID:       &user.ID,
			RepositoryID: &repo.ID,
			ActivityType: "push",
			Title:        "推送了代码",
			Content:      "3 个提交到 main 分支",
			CreatedAt:    now.Add(-1 * time.Hour),
		},
		{
			UserID:       &user.ID,
			RepositoryID: &repo.ID,
			ActivityType: "star",
			Title:        "给仓库点了星标",
			CreatedAt:    now.Add(-30 * time.Minute),
		},
		{
			UserID:       &user.ID,
			ActivityType: "comment",
			Title:        "发表了评论",
			Content:      "这个项目很棒！",
			CreatedAt:    now.Add(-15 * time.Minute),
		},
		{
			UserID:       &user.ID,
			RepositoryID: &repo.ID,
			ActivityType: "issue",
			Title:        "创建了 Issue #1",
			Content:      "修复登录页面的样式问题",
			CreatedAt:    now.Add(-5 * time.Minute),
		},
	}

	for _, a := range activities {
		err = db.Activity.Insert().One(a)
		if err != nil {
			log.Println("Activity error:", err)
		}
	}
	log.Println("Created", len(activities), "activities")

	// Create milestones
	dueDate1 := now.Add(30 * 24 * time.Hour)
	dueDate2 := now.Add(60 * 24 * time.Hour)
	milestones := []*models.Milestone{
		{
			Title:        "v1.0.0",
			Description:  "第一个正式版本发布",
			DueDate:      &dueDate1,
			RepositoryID: repo.ID,
			IsClosed:     false,
		},
		{
			Title:        "v1.1.0",
			Description:  "添加新功能和修复bug",
			DueDate:      &dueDate2,
			RepositoryID: repo.ID,
			IsClosed:     false,
		},
		{
			Title:        "v0.9.0",
			Description:  "Beta版本",
			RepositoryID: repo.ID,
			IsClosed:     true,
		},
	}

	for _, m := range milestones {
		err = db.Milestone.Insert().One(m)
		if err != nil {
			log.Println("Milestone error:", err)
		}
	}
	log.Println("Created", len(milestones), "milestones")

	// Create issues
	issues := []*models.Issue{
		{
			Title:        "修复登录页面样式问题",
			Body:         "登录页面在移动端显示不正确，需要调整响应式布局",
			Number:       1,
			RepositoryID: repo.ID,
			AuthorID:     user.ID,
			IsClosed:     false,
		},
		{
			Title:        "添加用户头像上传功能",
			Body:         "用户应该能够上传自己的头像图片",
			Number:       2,
			RepositoryID: repo.ID,
			AuthorID:     user.ID,
			IsClosed:     false,
		},
		{
			Title:        "优化数据库查询性能",
			Body:         "某些查询太慢了，需要添加索引或优化查询语句",
			Number:       3,
			RepositoryID: repo.ID,
			AuthorID:     user.ID,
			IsClosed:     true,
		},
	}

	for _, i := range issues {
		err = db.Issue.Insert().One(i)
		if err != nil {
			log.Println("Issue error:", err)
		}
	}
	log.Println("Created", len(issues), "issues")

	// Create pull requests
	prs := []*models.PullRequest{
		{
			Title:        "添加用户头像上传功能",
			Body:         "实现了用户头像上传和裁剪功能",
			Number:       1,
			RepositoryID: repo.ID,
			AuthorID:     user.ID,
			SourceBranch: "feature/avatar-upload",
			TargetBranch: "main",
			Status:       "open",
			IsClosed:     false,
			IsMerged:     false,
		},
		{
			Title:        "修复移动端样式问题",
			Body:         "修复了登录页面在移动端的显示问题",
			Number:       2,
			RepositoryID: repo.ID,
			AuthorID:     user.ID,
			SourceBranch: "fix/mobile-style",
			TargetBranch: "main",
			Status:       "merged",
			IsClosed:     true,
			IsMerged:     true,
		},
	}

	for _, pr := range prs {
		err = db.PullRequest.Insert().One(pr)
		if err != nil {
			log.Println("PullRequest error:", err)
		}
	}
	log.Println("Created", len(prs), "pull requests")

	log.Println("Seed data inserted successfully!")
}
