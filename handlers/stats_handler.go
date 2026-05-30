package handlers

import (
	"strconv"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/goent"
	"github.com/gofiber/fiber/v3"
)

type StatsResponse struct {
	TotalRepos   int    `json:"total_repos"`
	TotalUsers   int    `json:"total_users"`
	TotalIssues  int    `json:"total_issues"`
	TotalPRs     int    `json:"total_prs"`
	OpenIssues   int    `json:"open_issues"`
	ClosedIssues int    `json:"closed_issues"`
	OpenPRs      int    `json:"open_prs"`
	ClosedPRs    int    `json:"closed_prs"`
	TotalStars   int    `json:"total_stars"`
	TotalForks   int    `json:"total_forks"`
	Theme        string `json:"theme"`
	SiteMark     string `json:"site_mark"`
}

func GetStats(c fiber.Ctx) error {
	db := models.GetDB()

	totalRepos, _ := db.Repository.Count("id")
	totalUsers, _ := db.User.Count("id")
	totalIssues, _ := db.Issue.Count("id")
	totalPRs, _ := db.PullRequest.Count("id")

	openIssues, _ := db.Issue.Select().Filter(goent.Equals(db.Issue.Field("is_closed"), false)).Count("id")
	closedIssues, _ := db.Issue.Select().Filter(goent.Equals(db.Issue.Field("is_closed"), true)).Count("id")

	openPRs, _ := db.PullRequest.Select().Filter(
		goent.Equals(db.PullRequest.Field("is_closed"), false),
	).Count("id")
	closedPRs, _ := db.PullRequest.Select().Filter(
		goent.Equals(db.PullRequest.Field("is_closed"), true),
	).Count("id")

	totalStars, _ := db.RepositoryStats.SumFloat("stars_count")
	totalForks, _ := db.RepositoryStats.SumFloat("forks_count")

	stats := &StatsResponse{
		TotalRepos:   int(totalRepos),
		TotalUsers:   int(totalUsers),
		TotalIssues:  int(totalIssues),
		TotalPRs:     int(totalPRs),
		OpenIssues:   int(openIssues),
		ClosedIssues: int(closedIssues),
		OpenPRs:      int(openPRs),
		ClosedPRs:    int(closedPRs),
		TotalStars:   int(totalStars),
		TotalForks:   int(totalForks),
		Theme:        config.GetTheme(),
		SiteMark:     config.GetSiteMark(),
	}

	return c.Status(fiber.StatusOK).JSON(stats)
}

type RecentIssueResponse struct {
	ID        int64  `json:"id"`
	Number    int    `json:"number"`
	Title     string `json:"title"`
	IsClosed  bool   `json:"is_closed"`
	Owner     string `json:"owner"`
	Repo      string `json:"repo"`
	Author    string `json:"author"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

func GetRecentIssues(c fiber.Ctx) error {
	limit, _ := strconv.Atoi(c.Query("limit", "5"))
	if limit > 20 {
		limit = 20
	}

	db := models.GetDB()

	issues, err := db.Issue.Select().OrderBy("created_at DESC").Skip(0).Take(limit).All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch issues"})
	}

	repoCache := make(map[int64]*models.Repository)
	userCache := make(map[int64]*models.User)

	var result []RecentIssueResponse
	for _, issue := range issues {
		repo, ok := repoCache[issue.RepositoryID]
		if !ok {
			r, _ := db.Repository.Select().Where("id = ?", issue.RepositoryID).One()
			repo = r
			repoCache[issue.RepositoryID] = r
		}

		var ownerName string
		var repoName string
		if repo != nil {
			repoName = repo.Name
			if repo.OwnerType == "group" {
				group, _ := db.Group.Select().Where("id = ?", repo.OwnerID).One()
				if group != nil {
					ownerName = group.Name
				}
			} else {
				user, ok := userCache[repo.OwnerID]
				if !ok {
					u, _ := db.User.Select("username").Where("id = ?", repo.OwnerID).One()
					user = u
					userCache[repo.OwnerID] = u
				}
				if user != nil {
					ownerName = user.Username
				}
			}
		}

		var authorName string
		if issue.AuthorID > 0 {
			author, ok := userCache[issue.AuthorID]
			if !ok {
				u, _ := db.User.Select("username").Where("id = ?", issue.AuthorID).One()
				author = u
				userCache[issue.AuthorID] = u
			}
			if author != nil {
				authorName = author.Username
			}
		}

		result = append(result, RecentIssueResponse{
			ID:        issue.ID,
			Number:    issue.Number,
			Title:     issue.Title,
			IsClosed:  issue.IsClosed,
			Owner:     ownerName,
			Repo:      repoName,
			Author:    authorName,
			CreatedAt: issue.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			UpdatedAt: issue.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	if result == nil {
		result = []RecentIssueResponse{}
	}

	return c.Status(fiber.StatusOK).JSON(result)
}

type RecentTaskResponse struct {
	ID        int64  `json:"id"`
	Title     string `json:"title"`
	Status    string `json:"status"`
	Priority  int    `json:"priority"`
	Owner     string `json:"owner"`
	Repo      string `json:"repo"`
	Initiator string `json:"initiator"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

func GetRecentTasks(c fiber.Ctx) error {
	limit, _ := strconv.Atoi(c.Query("limit", "5"))
	if limit > 20 {
		limit = 20
	}

	db := models.GetDB()

	tasks, err := db.Task.Select().OrderBy("created_at DESC").Skip(0).Take(limit).All()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch tasks"})
	}

	repoCache := make(map[int64]*models.Repository)
	userCache := make(map[int64]*models.User)

	var result []RecentTaskResponse
	for _, task := range tasks {
		repo, ok := repoCache[task.RepositoryID]
		if !ok {
			r, _ := db.Repository.Select().Where("id = ?", task.RepositoryID).One()
			repo = r
			repoCache[task.RepositoryID] = r
		}

		var ownerName string
		var repoName string
		if repo != nil {
			repoName = repo.Name
			if repo.OwnerType == "group" {
				group, _ := db.Group.Select().Where("id = ?", repo.OwnerID).One()
				if group != nil {
					ownerName = group.Name
				}
			} else {
				user, ok := userCache[repo.OwnerID]
				if !ok {
					u, _ := db.User.Select("username").Where("id = ?", repo.OwnerID).One()
					user = u
					userCache[repo.OwnerID] = u
				}
				if user != nil {
					ownerName = user.Username
				}
			}
		}

		var initiatorName string
		if task.InitiatorID > 0 {
			initiator, ok := userCache[task.InitiatorID]
			if !ok {
				u, _ := db.User.Select("username").Where("id = ?", task.InitiatorID).One()
				initiator = u
				userCache[task.InitiatorID] = u
			}
			if initiator != nil {
				initiatorName = initiator.Username
			}
		}

		result = append(result, RecentTaskResponse{
			ID:        task.ID,
			Title:     task.Title,
			Status:    task.Status,
			Priority:  task.Priority,
			Owner:     ownerName,
			Repo:      repoName,
			Initiator: initiatorName,
			CreatedAt: task.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			UpdatedAt: task.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	if result == nil {
		result = []RecentTaskResponse{}
	}

	return c.Status(fiber.StatusOK).JSON(result)
}
