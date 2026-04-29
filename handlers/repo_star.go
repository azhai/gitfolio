package handlers

import (
	"github.com/azhai/gitfolio/helpers"
	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/gitfolio/services"
	"github.com/gofiber/fiber/v3"
)

// StarRepository 收藏仓库
func StarRepository(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)
	result, err := helpers.GetOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	existingStar, _ := db.Star.Select().Where("user_id = ? AND repository_id = ?", userID, result.Repo.ID).One()
	if existingStar != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Already starred"})
	}

	star := &models.Star{UserID: userID, RepositoryID: result.Repo.ID}
	err = db.Star.Insert().One(star)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to star repository"})
	}

	statsSvc := services.NewStatsService(db)
	stats, _ := statsSvc.GetRepositoryStats(result.Repo.ID)
	if stats != nil {
		stats.StarsCount++
		db.RepositoryStats.Save().One(stats)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Repository starred successfully"})
}

// UnstarRepository 取消收藏仓库
func UnstarRepository(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)
	result, err := helpers.GetOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()
	err = db.Star.Delete().Where("user_id = ? AND repository_id = ?", userID, result.Repo.ID).Exec()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to unstar repository"})
	}

	statsSvc := services.NewStatsService(db)
	stats, _ := statsSvc.GetRepositoryStats(result.Repo.ID)
	if stats != nil && stats.StarsCount > 0 {
		stats.StarsCount--
		db.RepositoryStats.Save().One(stats)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Repository unstarred successfully"})
}

// WatchRepository 关注仓库
func WatchRepository(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)
	result, err := helpers.GetOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()

	existingWatch, _ := db.Watch.Select().Where("user_id = ? AND repository_id = ?", userID, result.Repo.ID).One()
	if existingWatch != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Already watching"})
	}

	watch := &models.Watch{UserID: userID, RepositoryID: result.Repo.ID}
	err = db.Watch.Insert().One(watch)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to watch repository"})
	}

	statsSvc := services.NewStatsService(db)
	stats, _ := statsSvc.GetRepositoryStats(result.Repo.ID)
	if stats != nil {
		stats.WatchCount++
		db.RepositoryStats.Save().One(stats)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Watching repository successfully"})
}

// UnwatchRepository 取消关注仓库
func UnwatchRepository(c fiber.Ctx) error {
	userID := middleware.GetCurrentUserID(c)
	result, err := helpers.GetOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	db := models.GetDB()
	err = db.Watch.Delete().Where("user_id = ? AND repository_id = ?", userID, result.Repo.ID).Exec()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to unwatch repository"})
	}

	statsSvc := services.NewStatsService(db)
	stats, _ := statsSvc.GetRepositoryStats(result.Repo.ID)
	if stats != nil && stats.WatchCount > 0 {
		stats.WatchCount--
		db.RepositoryStats.Save().One(stats)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Unwatched repository successfully"})
}

// RefreshRepositoryStats 重新计算并刷新仓库统计数据
func RefreshRepositoryStats(c fiber.Ctx) error {
	result, err := helpers.RequireOwnerAndRepoFromParams(c)
	if err != nil {
		return err
	}

	statsSvc := services.NewStatsService(models.GetDB())
	if err := statsSvc.UpdateRepositoryStats(result.Repo.ID, result.Owner.Username, result.Repo.Name); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to refresh stats"})
	}

	stats, _ := statsSvc.GetRepositoryStats(result.Repo.ID)
	return c.Status(fiber.StatusOK).JSON(stats)
}
