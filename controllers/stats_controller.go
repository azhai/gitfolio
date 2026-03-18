package controllers

import (
	"github.com/azhai/gitfolio/database"
	"github.com/gofiber/fiber/v3"
)

type StatsResponse struct {
	TotalRepos   int `json:"total_repos"`
	TotalUsers   int `json:"total_users"`
	TotalIssues  int `json:"total_issues"`
	TotalMRs     int `json:"total_mrs"`
	OpenIssues   int `json:"open_issues"`
	ClosedIssues int `json:"closed_issues"`
	OpenMRs      int `json:"open_mrs"`
	MergedMRs    int `json:"merged_mrs"`
	TotalStars   int `json:"total_stars"`
	TotalForks   int `json:"total_forks"`
}

func GetStats(c fiber.Ctx) error {
	db := database.GetDB()

	users, _ := db.User.Select().All()
	repos, _ := db.Repository.Select().All()
	issues, _ := db.Issue.Select().All()
	mrs, _ := db.MergeRequest.Select().All()

	openIssues := 0
	closedIssues := 0
	for _, issue := range issues {
		if issue.IsClosed {
			closedIssues++
		} else {
			openIssues++
		}
	}

	openMRs := 0
	mergedMRs := 0
	for _, mr := range mrs {
		if mr.IsMerged {
			mergedMRs++
		} else if !mr.IsClosed {
			openMRs++
		}
	}

	totalStars := 0
	totalForks := 0
	for _, repo := range repos {
		totalStars += repo.StarsCount
		totalForks += repo.ForksCount
	}

	stats := &StatsResponse{
		TotalRepos:   len(repos),
		TotalUsers:   len(users),
		TotalIssues:  len(issues),
		TotalMRs:     len(mrs),
		OpenIssues:   openIssues,
		ClosedIssues: closedIssues,
		OpenMRs:      openMRs,
		MergedMRs:    mergedMRs,
		TotalStars:   totalStars,
		TotalForks:   totalForks,
	}

	return c.Status(fiber.StatusOK).JSON(stats)
}
