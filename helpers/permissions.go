package helpers

import (
	"github.com/azhai/gitfolio/middleware"
	"github.com/gofiber/fiber/v3"
)

func CheckOwnerPermission(c fiber.Ctx, ownerID int64) bool {
	userID := middleware.GetCurrentUserID(c)
	return userID != 0 && userID == ownerID
}

func RequireOwner(c fiber.Ctx, ownerID int64) error {
	if !CheckOwnerPermission(c, ownerID) {
		return JSONError(c, HTTPStatusForbidden, "Access denied")
	}
	return nil
}

func CheckUserPermission(c fiber.Ctx, userID *int64) bool {
	if userID == nil {
		return false
	}
	currentUserID := middleware.GetCurrentUserID(c)
	return currentUserID != 0 && currentUserID == *userID
}

func RequireUser(c fiber.Ctx, userID *int64) error {
	if !CheckUserPermission(c, userID) {
		return JSONError(c, HTTPStatusForbidden, "Access denied")
	}
	return nil
}

func CheckPrivateAccess(c fiber.Ctx, isPrivate bool, ownerID int64) bool {
	if !isPrivate {
		return true
	}
	return CheckOwnerPermission(c, ownerID)
}

func RequirePrivateAccess(c fiber.Ctx, isPrivate bool, ownerID int64) error {
	if !CheckPrivateAccess(c, isPrivate, ownerID) {
		return JSONError(c, HTTPStatusForbidden, "Access denied")
	}
	return nil
}

func GetCurrentUserID(c fiber.Ctx) int64 {
	return middleware.GetCurrentUserID(c)
}

func IsAuthenticated(c fiber.Ctx) bool {
	return middleware.GetCurrentUserID(c) != 0
}

func RequireAuth(c fiber.Ctx) error {
	if !IsAuthenticated(c) {
		return JSONError(c, HTTPStatusUnauthorized, "Authentication required")
	}
	return nil
}
