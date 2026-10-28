package config

import (
	"github.com/azhai/gobus/environ"
	"github.com/azhai/goent/drivers"
)

type Config struct {
	Server     ServerConfig
	Database   drivers.DatabaseConfig
	Auth       AuthConfig
	Admin      AdminConfig
	Repository RepositoryConfig
	Github     GithubConfig
	Proxy      ProxyConfig
}

type ServerConfig struct {
	Mode     string
	Theme    string
	Port     int
	BaseURL  string
	SiteMark string
}

type AuthConfig struct {
	JWTSecret     string
	SessionSecret string
	TokenExpiry   int
}

type AdminConfig struct {
	Username string
	Password string
	Email    string
}

type RepositoryConfig struct {
	// Root 是全局裸仓库根目录。账号未设置自有仓库目录时，
	// 仓库以裸仓库形式存放在 <Root>/<账号名>/<仓库名>.git。
	Root string
	// LocalRoot 是历史遗留的本地仓库平铺目录，仅用于定位迁移前创建的
	// 老仓库（OwnerID=0 且 LocalPath 指向此处）。新仓库不再使用它。
	LocalRoot string
}

type ProxyConfig struct {
	URL string
}

type GithubConfig struct {
	Username string
	Token    string
}

var cfg *Config

// Load 初始化全局配置。仅在 main 启动时调用一次；
// 重复调用不会覆盖已加载的配置，避免运行期误用空 Environ 清空 token 等。
func Load(env *environ.Environ) *Config {
	if cfg != nil {
		return cfg
	}
	if env == nil {
		env = environ.NewEmptyEnviron()
	}
	cfg = &Config{
		Server: ServerConfig{
			Mode:     env.GetStr("APP_MODE", "debug"),
			Theme:    env.GetStr("APP_THEME", "orange"),
			Port:     env.GetInt("SERVER_PORT", 3000),
			BaseURL:  env.GetStr("BASE_URL", "http://localhost:3000"),
			SiteMark: env.GetStr("SITE_MARK", ""),
		},
		Database: drivers.LoadConfig(env, "gitfolio.db"),
		Auth: AuthConfig{
			JWTSecret:     env.GetStr("JWT_SECRET", "your-secret-key-change-in-production"),
			SessionSecret: env.GetStr("SESSION_SECRET", "session-secret-key"),
			TokenExpiry:   env.GetInt("TOKEN_EXPIRY", 24),
		},
		Admin: AdminConfig{
			Username: env.GetStr("ADMIN_USERNAME", "admin"),
			Password: env.GetStr("ADMIN_PASSWORD", ""),
		},
		Repository: RepositoryConfig{
			Root:      env.GetStr("REPO_ROOT", "./repos"),
			LocalRoot: env.GetStr("LOCAL_ROOT", "./repos/local"),
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

// GetConfig 返回已加载的全局配置。未初始化时 panic，避免空指针在深处爆出。
func GetConfig() *Config {
	if cfg == nil {
		panic("config not loaded: call config.Load at startup before using GetConfig")
	}
	return cfg
}

func GetServerInfo() (int, string) {
	return cfg.Server.Port, cfg.Server.BaseURL
}

func GetServerMode() string { return cfg.Server.Mode }
func GetTheme() string      { return cfg.Server.Theme }
func GetSiteMark() string   { return cfg.Server.SiteMark }
func GetRepoRoot() string   { return cfg.Repository.Root }
func GetLocalRoot() string  { return cfg.Repository.LocalRoot }
func GetJWTSecret() string {
	return cfg.Auth.JWTSecret
}
func GetSessionSecret() string { return cfg.Auth.SessionSecret }
func GetTokenExpiry() int      { return cfg.Auth.TokenExpiry }
func GetProxyURL() string      { return cfg.Proxy.URL }
func GetUserToken() (string, string) {
	return cfg.Github.Username, cfg.Github.Token
}
