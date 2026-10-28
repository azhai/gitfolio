package handlers

import (
	"strconv"
	"time"

	"github.com/azhai/gitfolio/models"
	"github.com/azhai/gitfolio/services"
	"github.com/gofiber/fiber/v3"
)

// RunSchedulerCron is meant to be called by an external system cron every 10 minutes.
// It runs all due sync jobs concurrently with a per-repo random delay.
//
// Query parameters:
//   - time: optional ISO8601 timestamp used as the "current" time (for testing).
//   - concurrency: optional max concurrent jobs (default 4).
func RunSchedulerCron(c fiber.Ctx) error {
	db := models.GetDB()

	now := time.Now().UTC()
	if t := c.Query("time"); t != "" {
		if parsed, err := time.Parse(time.RFC3339, t); err == nil {
			now = parsed.UTC()
		}
	}

	concurrency := 4
	if n := c.Query("concurrency"); n != "" {
		if v, err := strconv.Atoi(n); err == nil && v > 0 {
			concurrency = v
		}
	}

	scheduler := services.NewSchedulerService(db)
	scheduled, err := scheduler.RunCronTick(now, concurrency)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message":   "cron tick processed",
		"scheduled": scheduled,
		"time":      now.Format(time.RFC3339),
	})
}
