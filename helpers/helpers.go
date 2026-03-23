package helpers

import (
	"strconv"

	"github.com/gofiber/fiber/v3"
)

const (
	DefaultPage    = 1
	DefaultPerPage = 30
	DefaultBranch  = "main"

	HTTPStatusOK                  = 200
	HTTPStatusCreated             = 201
	HTTPStatusBadRequest          = 400
	HTTPStatusUnauthorized        = 401
	HTTPStatusForbidden           = 403
	HTTPStatusNotFound            = 404
	HTTPStatusInternalServerError = 500
)

type PaginationParams struct {
	Page    int
	PerPage int
}

func GetPagination(c fiber.Ctx) PaginationParams {
	page, _ := strconv.Atoi(c.Query("page", strconv.Itoa(DefaultPage)))
	perPage, _ := strconv.Atoi(c.Query("per_page", strconv.Itoa(DefaultPerPage)))

	if page < 1 {
		page = DefaultPage
	}
	if perPage < 1 || perPage > 100 {
		perPage = DefaultPerPage
	}

	return PaginationParams{
		Page:    page,
		PerPage: perPage,
	}
}

func JSONError(c fiber.Ctx, status int, message string) error {
	return c.Status(status).JSON(fiber.Map{"error": message})
}

func JSONSuccess(c fiber.Ctx, data interface{}) error {
	return c.Status(HTTPStatusOK).JSON(data)
}

func JSONCreated(c fiber.Ctx, data interface{}) error {
	return c.Status(HTTPStatusCreated).JSON(data)
}

func ParseUintParam(c fiber.Ctx, param string) (uint64, error) {
	return strconv.ParseUint(c.Params(param), 10, 64)
}

func ParseIntParam(c fiber.Ctx, param string) (int, error) {
	return strconv.Atoi(c.Params(param))
}

func GetOffset(page, perPage int) int {
	return (page - 1) * perPage
}

type Response struct {
	Data   interface{} `json:"data"`
	Page   int         `json:"page,omitempty"`
	PerPage int        `json:"per_page,omitempty"`
	Total  int64       `json:"total,omitempty"`
}

func NewResponse(data interface{}) *Response {
	return &Response{Data: data}
}

func NewPaginatedResponse(data interface{}, page, perPage int, total int64) *Response {
	return &Response{
		Data:    data,
		Page:    page,
		PerPage: perPage,
		Total:   total,
	}
}
