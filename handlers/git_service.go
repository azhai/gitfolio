package handlers

import (
	"github.com/azhai/gitfolio/helpers"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/gitfolio/services"
)

// gitSvcFor 返回按仓库落盘位置配置好的 Git 服务。
//
// 仓库已记录 LocalPath 时直接使用它；否则按所有者的自有仓库目录计算
// （有自有目录为普通仓库，无则为全局裸仓库目录下的裸仓库）。
func gitSvcFor(result *helpers.ResourceResult) *services.GitService {
	return services.NewGitService().
		WithOwnerRoot(result.RepoRoot()).
		WithProjectType(result.Repo.ProjectType).
		WithLocalPath(result.Repo.LocalPath)
}

// gitSvcForRepo 同 gitSvcFor，但附带数据库以便记录 git 命令日志。
func gitSvcForRepo(db *models.Database, result *helpers.ResourceResult) *services.GitService {
	return services.NewGitServiceWithDB(db).
		WithOwnerRoot(result.RepoRoot()).
		WithProjectType(result.Repo.ProjectType).
		WithLocalPath(result.Repo.LocalPath)
}

// ownerRepoRoot 返回账号（用户或团队）的自有仓库目录。
func ownerRepoRoot(user *models.User, group *models.Group) string {
	if user != nil {
		return user.RepoRoot
	}
	if group != nil {
		return group.RepoRoot
	}
	return ""
}

// resolveRepoRootByAccount 按账号名（用户名或团队名）查找自有仓库目录，
// 找不到对应账号时返回空字符串（即回退到全局裸仓库目录）。
func resolveRepoRootByAccount(db *models.Database, account string) string {
	if account == "" {
		return ""
	}
	if user, err := db.User.Select().Where("username = ?", account).One(); err == nil && user != nil {
		return user.RepoRoot
	}
	if group, err := db.Group.Select().Where("name = ?", account).One(); err == nil && group != nil {
		return group.RepoRoot
	}
	return ""
}
