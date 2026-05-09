package helpers

import (
	"strconv"
	"time"

	"github.com/azhai/gitfolio/config"
	"github.com/gofiber/fiber/v3"
)

var cstZone = time.FixedZone("CST", 8*3600)

func FormatTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.In(cstZone).Format("2006-01-02T15:04:05+08:00")
}

const (
	HTTPStatusOK                  = 200
	HTTPStatusCreated             = 201
	HTTPStatusBadRequest          = 400
	HTTPStatusUnauthorized        = 401
	HTTPStatusForbidden           = 403
	HTTPStatusNotFound            = 404
	HTTPStatusInternalServerError = 500
)

// PaginationParams 分页参数
type PaginationParams struct {
	Page    int
	PerPage int
}

// GetPagination 从查询参数中提取分页信息，使用默认值兜底
func GetPagination(c fiber.Ctx) PaginationParams {
	page, _ := strconv.Atoi(c.Query("page", strconv.Itoa(config.DefaultPage)))
	perPage, _ := strconv.Atoi(c.Query("per_page", strconv.Itoa(config.DefaultPerPage)))

	if page < 1 {
		page = config.DefaultPage
	}
	if perPage < 1 || perPage > config.MaxPerPage {
		perPage = config.DefaultPerPage
	}

	return PaginationParams{
		Page:    page,
		PerPage: perPage,
	}
}

// GetOffset 根据页码和每页数量计算偏移量
func GetOffset(page, perPage int) int {
	return (page - 1) * perPage
}

// JSONError 返回 JSON 格式的错误响应
func JSONError(c fiber.Ctx, status int, message string) error {
	return fiber.NewError(status, message)
}

// JSONSuccess 返回 JSON 格式的成功响应（200）
func JSONSuccess(c fiber.Ctx, data interface{}) error {
	return c.Status(HTTPStatusOK).JSON(data)
}

// JSONCreated 返回 JSON 格式的创建成功响应（201）
func JSONCreated(c fiber.Ctx, data interface{}) error {
	return c.Status(HTTPStatusCreated).JSON(data)
}

// ParseUintParam 从路径参数中解析无符号整数
func ParseUintParam(c fiber.Ctx, param string) (uint64, error) {
	return strconv.ParseUint(c.Params(param), 10, 64)
}

// ParseIntParam 从路径参数中解析整数
func ParseIntParam(c fiber.Ctx, param string) (int, error) {
	return strconv.Atoi(c.Params(param))
}

// Response 通用 API 响应结构
type Response struct {
	Data    interface{} `json:"data"`
	Page    int         `json:"page,omitempty"`
	PerPage int         `json:"per_page,omitempty"`
	Total   int64       `json:"total,omitempty"`
}

// NewResponse 创建不含分页信息的响应
func NewResponse(data interface{}) *Response {
	return &Response{Data: data}
}

// NewPaginatedResponse 创建含分页信息的响应
func NewPaginatedResponse(data interface{}, page, perPage int, total int64) *Response {
	return &Response{
		Data:    data,
		Page:    page,
		PerPage: perPage,
		Total:   total,
	}
}
