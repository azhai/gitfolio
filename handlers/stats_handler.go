package handlers

import (
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
	MergedPRs    int    `json:"merged_prs"`
	TotalStars   int    `json:"total_stars"`
	TotalForks   int    `json:"total_forks"`
	Theme        string `json:"theme"`
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
		goent.And(
			goent.Equals(db.PullRequest.Field("is_closed"), false),
			goent.Equals(db.PullRequest.Field("is_merged"), false),
		),
	).Count("id")
	mergedPRs, _ := db.PullRequest.Select().Filter(
		goent.Equals(db.PullRequest.Field("is_merged"), true),
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
		MergedPRs:    int(mergedPRs),
		TotalStars:   int(totalStars),
		TotalForks:   int(totalForks),
		Theme:        config.AppConfig.Server.Theme,
	}

	return c.Status(fiber.StatusOK).JSON(stats)
}
