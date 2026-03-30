package handlers

import (
	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/models"
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
	MergedPRs    int    `json:"merged_prs"`
	TotalStars   int    `json:"total_stars"`
	TotalForks   int    `json:"total_forks"`
	Theme        string `json:"theme"`
}

func GetStats(c fiber.Ctx) error {
	db := models.GetDB()

	users, _ := db.User.Select().All()
	repos, _ := db.Repository.Select().All()
	issues, _ := db.Issue.Select().All()
	prs, _ := db.PullRequest.Select().All()

	openIssues := 0
	closedIssues := 0
	for _, issue := range issues {
		if issue.IsClosed {
			closedIssues++
		} else {
			openIssues++
		}
	}

	openPRs := 0
	mergedPRs := 0
	for _, pr := range prs {
		if pr.IsMerged {
			mergedPRs++
		} else if !pr.IsClosed {
			openPRs++
		}
	}

	totalStars := 0
	totalForks := 0
	for _, repo := range repos {
		stats, err := db.RepositoryStats.Select().Where("repository_id = ?", repo.ID).One()
		if err == nil && stats != nil {
			totalStars += stats.StarsCount
			totalForks += stats.ForksCount
		}
	}

	stats := &StatsResponse{
		TotalRepos:   len(repos),
		TotalUsers:   len(users),
		TotalIssues:  len(issues),
		TotalPRs:     len(prs),
		OpenIssues:   openIssues,
		ClosedIssues: closedIssues,
		OpenPRs:      openPRs,
		MergedPRs:    mergedPRs,
		TotalStars:   totalStars,
		TotalForks:   totalForks,
		Theme:        config.AppConfig.Server.Theme,
	}

	return c.Status(fiber.StatusOK).JSON(stats)
}
