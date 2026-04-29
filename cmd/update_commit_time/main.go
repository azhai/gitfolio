package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/azhai/gitfolio/models"
	"github.com/azhai/goent/utils"
)

func main() {
	env := utils.NewEnv()
	models.OpenDB(env)
	defer models.CloseDB()
	db := models.GetDB()

	repos, err := db.Repository.Select().All()
	if err != nil {
		log.Fatal("Failed to fetch repos:", err)
	}

	for _, repo := range repos {
		fmt.Printf("检查 %s: local_path=%q is_mirror=%v\n", repo.Name, repo.LocalPath, repo.IsMirror)
		localPath := repo.LocalPath
		if localPath == "" || repo.IsMirror {
			fmt.Printf("跳过 %s (无本地路径或镜像仓库)\n", repo.Name)
			continue
		}

		if _, err := os.Stat(localPath); os.IsNotExist(err) && strings.HasSuffix(localPath, ".git") {
			localPath = strings.TrimSuffix(localPath, ".git")
		}

		if _, err := os.Stat(localPath); os.IsNotExist(err) {
			newPath := "repos/local/" + repo.Name
			if _, statErr := os.Stat(newPath); statErr == nil {
				localPath = newPath
				repo.LocalPath = newPath
			} else {
				fmt.Printf("跳过 %s (路径不存在: %s)\n", repo.Name, localPath)
				continue
			}
		}

		if isBare, _ := isBareRepo(localPath); isBare {
			fmt.Printf("跳过 %s (裸仓库)\n", repo.Name)
			continue
		}

		cmd := exec.Command("git", "-C", localPath, "log", "-1", "--format=%ci")
		output, err := cmd.Output()
		if err != nil || len(strings.TrimSpace(string(output))) == 0 {
			fmt.Printf("跳过 %s (无提交记录)\n", repo.Name)
			continue
		}

		timeStr := strings.TrimSpace(string(output))
		t, err := time.Parse("2006-01-02 15:04:05 -0700", timeStr)
		if err != nil {
			fmt.Printf("跳过 %s (解析时间失败: %v)\n", repo.Name, err)
			continue
		}

		repo.LastCommitAt = &t
		if err := db.Repository.Save().One(repo); err != nil {
			log.Printf("更新 %s 失败: %v\n", repo.Name, err)
			continue
		}
		fmt.Printf("已更新 %s: last_commit_at = %s\n", repo.Name, t.Format("2006-01-02 15:04:05"))
	}
	fmt.Println("全部完成")
}

func isBareRepo(path string) (bool, error) {
	cmd := exec.Command("git", "-C", path, "rev-parse", "--is-bare-repository")
	output, err := cmd.Output()
	if err != nil {
		return false, err
	}
	return strings.TrimSpace(string(output)) == "true", nil
}
