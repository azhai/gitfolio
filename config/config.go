package config

import (
	"github.com/azhai/goent/utils"
)

// Config 应用全局配置
type Config struct {
	Server     ServerConfig
	Database   DatabaseConfig
	Auth       AuthConfig
	Github     GithubConfig
	Repository RepositoryConfig
}

// ServerConfig 服务器配置
type ServerConfig struct {
	Mode    string
	Theme   string
	Port    string
	BaseURL string
}

// DatabaseConfig 数据库连接配置
type DatabaseConfig struct {
	Type string
	DSN  string
}

// GetDSN 根据数据库类型生成数据源连接串
func (d DatabaseConfig) GetDSN() string {
	return d.DSN
}

// AuthConfig 认证配置
type AuthConfig struct {
	JWTSecret     string
	SessionSecret string
	TokenExpiry   int
}

// GithubConfig GitHub API 配置
type GithubConfig struct {
	Username string
	Token    string
}

// RepositoryConfig 仓库存储配置
type RepositoryConfig struct {
	Root string
}

// AppConfig 全局配置单例
var AppConfig *Config

// Load 从环境变量加载应用配置，未设置时使用默认值
func Load() *Config {
	env := utils.NewEnv()

	config := &Config{
		Server: ServerConfig{
			Mode:    env.GetStr("APP_MODE", "debug"),
			Theme:   env.GetStr("APP_THEME", "orange"),
			Port:    env.GetStr("SERVER_PORT", "3000"),
			BaseURL: env.GetStr("BASE_URL", "http://localhost:3000"),
		},
		Database: DatabaseConfig{
			Type: env.GetStr("DB_TYPE", "sqlite"),
			DSN:  env.GetStr("DB_DSN", "gitfolio.db"),
		},
		Auth: AuthConfig{
			JWTSecret:     env.GetStr("JWT_SECRET", "your-secret-key-change-in-production"),
			SessionSecret: env.GetStr("SESSION_SECRET", "session-secret-key"),
			TokenExpiry:   env.GetInt("TOKEN_EXPIRY", 24),
		},
		Github: GithubConfig{
			Username: env.GetStr("GHITHUB_USERNAME", ""),
			Token:    env.GetStr("GHITHUB_TOKEN", ""),
		},
		Repository: RepositoryConfig{
			Root: env.GetStr("REPO_ROOT", "./repos"),
		},
	}

	AppConfig = config
	return config
}
