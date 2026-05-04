package services

import (
	"fmt"
	"net/http"
	"net/url"
	"os/exec"
	"time"

	"github.com/azhai/gitfolio/config"
)

func NewHTTPClient(timeout time.Duration) *http.Client {
	proxyURL := config.GetProxyURL()
	if proxyURL == "" {
		return &http.Client{Timeout: timeout}
	}

	proxyParsed, err := url.Parse(proxyURL)
	if err != nil {
		return &http.Client{Timeout: timeout}
	}

	return &http.Client{
		Timeout: timeout,
		Transport: &http.Transport{
			Proxy: http.ProxyURL(proxyParsed),
		},
	}
}

func ConfigureGitProxy() error {
	proxyURL := config.GetProxyURL()
	if proxyURL == "" {
		cmd := exec.Command("git", "config", "--global", "--unset", "http.proxy")
		cmd.Run()
		cmd = exec.Command("git", "config", "--global", "--unset", "https.proxy")
		cmd.Run()
		return nil
	}

	cmd := exec.Command("git", "config", "--global", "http.proxy", proxyURL)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to set git http.proxy: %w", err)
	}

	cmd = exec.Command("git", "config", "--global", "https.proxy", proxyURL)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to set git https.proxy: %w", err)
	}

	return nil
}
