package services

import (
	"strings"

	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/models"
)

// RepoLocation 是仓库落盘位置的描述，定义见 models.RepoLocation。
type RepoLocation = models.RepoLocation

// ResolveRepoLocation 计算仓库应存放的位置，全局裸仓库根目录取自配置。
//
// 镜像项目始终是全局裸仓库目录下的裸仓库；其余项目在账号设置了自有仓库
// 目录时为普通仓库，否则同样是全局裸仓库目录下的裸仓库。
func ResolveRepoLocation(account, repoRoot, name, projectType string) RepoLocation {
	return models.ResolveRepoLocationUnder(config.GetRepoRoot(), account, repoRoot, name, projectType)
}

// LocationForRepo 计算已有仓库的落盘位置。
//
// 优先信任仓库记录的 LocalPath（迁移前的老仓库，或管理员手工挪动过的仓库）；
// LocalPath 为空时才按规则计算，形态由规则决定。
func LocationForRepo(repo *models.Repository, account, repoRoot string) RepoLocation {
	if repo == nil {
		return ResolveRepoLocation(account, repoRoot, "", "")
	}
	if p := strings.TrimSpace(repo.LocalPath); p != "" {
		return RepoLocation{Path: p, Storage: models.StorageOfPath(p)}
	}
	return ResolveRepoLocation(account, repoRoot, repo.Name, repo.ProjectType)
}
