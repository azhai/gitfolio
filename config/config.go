package config

import (
	"fmt"

	"github.com/azhai/goent/utils"
)

type Config struct {
	Server     ServerConfig
	Database   DatabaseConfig
	Auth       AuthConfig
	Repository RepositoryConfig
}

type ServerConfig struct {
	Port    string
	Mode    string
	BaseURL string
}

type DatabaseConfig struct {
	Type     string
	Host     string
	Port     int
	User     string
	Password string
	Name     string
	SSLMode  string
}

func (d DatabaseConfig) GetDSN() string {
	if d.Type == "sqlite" {
		return d.Name
	}
	tpl := "postgres://%s:%s@%s:%d/%s?sslmode=%s"
	return fmt.Sprintf(tpl, d.User, d.Password, d.Host, d.Port, d.Name, d.SSLMode)
}

type AuthConfig struct {
	JWTSecret     string
	SessionSecret string
	TokenExpiry   int
}

type RepositoryConfig struct {
	Root string
}

var AppConfig *Config

func Load() *Config {
	env := utils.NewEnv()

	config := &Config{
		Server: ServerConfig{
			Mode:    env.GetStr("APP_MODE", "debug"),
			Port:    env.GetStr("SERVER_PORT", "3000"),
			BaseURL: env.GetStr("BASE_URL", "http://localhost:3000"),
		},
		Database: DatabaseConfig{
			Type:     env.GetStr("DB_TYPE", "sqlite"),
			Host:     env.GetStr("DB_HOST", "localhost"),
			Port:     env.GetInt("DB_PORT", 5432),
			User:     env.GetStr("DB_USER", ""),
			Password: env.GetStr("DB_PASSWORD", ""),
			Name:     env.GetStr("DB_NAME", "gitfolio.db"),
			SSLMode:  env.GetStr("DB_SSLMODE", "disable"),
		},
		Auth: AuthConfig{
			JWTSecret:     env.GetStr("JWT_SECRET", "your-secret-key-change-in-production"),
			SessionSecret: env.GetStr("SESSION_SECRET", "session-secret-key"),
			TokenExpiry:   env.GetInt("TOKEN_EXPIRY", 24),
		},
		Repository: RepositoryConfig{
			Root: env.GetStr("REPO_ROOT", "./repos"),
		},
	}

	AppConfig = config
	return config
}
