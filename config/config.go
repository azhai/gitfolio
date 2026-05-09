package config

import (
	"github.com/azhai/goent/utils"
)

type Config struct {
	Server     ServerConfig
	Database   DatabaseConfig
	Auth       AuthConfig
	Repository RepositoryConfig
	Github     GithubConfig
	Proxy      ProxyConfig
}

type ServerConfig struct {
	Mode    string
	Theme   string
	Port    int
	BaseURL string
}

type DatabaseConfig struct {
	Type    string
	DSN     string
	LogFile string
}

func (d DatabaseConfig) GetDSN() string {
	return d.DSN
}

type AuthConfig struct {
	JWTSecret     string
	SessionSecret string
	TokenExpiry   int
}

type RepositoryConfig struct {
	Root string
}

type ProxyConfig struct {
	URL string
}

type GithubConfig struct {
	Username string
	Token    string
}

var cfg *Config

func Load(env *utils.Environ) *Config {
	cfg = &Config{
		Server: ServerConfig{
			Mode:    env.GetStr("APP_MODE", "debug"),
			Theme:   env.GetStr("APP_THEME", "orange"),
			Port:    env.GetInt("SERVER_PORT", 3000),
			BaseURL: env.GetStr("BASE_URL", "http://localhost:3000"),
		},
		Database: DatabaseConfig{
			Type:    env.GetStr("DB_TYPE", "sqlite"),
			DSN:     env.GetStr("DB_DSN", "gitfolio.db"),
			LogFile: env.GetStr("LOG_FILE", "stdout"),
		},
		Auth: AuthConfig{
			JWTSecret:     env.GetStr("JWT_SECRET", "your-secret-key-change-in-production"),
			SessionSecret: env.GetStr("SESSION_SECRET", "session-secret-key"),
			TokenExpiry:   env.GetInt("TOKEN_EXPIRY", 24),
		},
		Repository: RepositoryConfig{
			Root: env.GetStr("REPO_ROOT", "./repos"),
		},
		Proxy: ProxyConfig{
			URL: env.GetStr("PROXY_URL", ""),
		},
		Github: GithubConfig{
			Username: env.GetStr("GHITHUB_USERNAME", ""),
			Token:    env.GetStr("GHITHUB_TOKEN", ""),
		},
	}
	return cfg
}

func GetConfig() *Config {
	return cfg
}

func GetServerInfo() (int, string) {
	return cfg.Server.Port, cfg.Server.BaseURL
}

func GetServerMode() string { return cfg.Server.Mode }
func GetTheme() string      { return cfg.Server.Theme }
func GetRepoRoot() string   { return cfg.Repository.Root }
func GetJWTSecret() string {
	return cfg.Auth.JWTSecret
}
func GetSessionSecret() string { return cfg.Auth.SessionSecret }
func GetTokenExpiry() int      { return cfg.Auth.TokenExpiry }
func GetProxyURL() string      { return cfg.Proxy.URL }
func GetUserToken() (string, string) {
	return cfg.Github.Username, cfg.Github.Token
}
