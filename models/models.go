package models

import (
	"time"

	"golang.org/x/crypto/bcrypt"
)

type User struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Username string `goe:"unique"`
	Email    string `goe:"unique"`
	Password string
	FullName string
	Avatar   string
	Bio      string
	Website  string
	Location string

	IsActive bool `goe:"default:true"`
	IsAdmin  bool `goe:"default:false"`
}

func (u *User) SetPassword(password string) error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.Password = string(hashedPassword)
	return nil
}

func (u *User) CheckPassword(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(password))
	return err == nil
}

type Repository struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Name        string `goe:"index"`
	Description string
	OwnerID     uint `goe:"index"`

	IsPrivate bool `goe:"default:false"`
	IsFork    bool `goe:"default:false"`

	StarsCount int `goe:"default:0"`
	ForksCount int `goe:"default:0"`
	WatchCount int `goe:"default:0"`

	DefaultBranch string `goe:"default:'main'"`
}

type Branch struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Name         string
	RepositoryID uint `goe:"index"`

	CommitHash string
	CommitMsg  string
}

type Issue struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Title string
	Body  string

	RepositoryID uint `goe:"index"`

	AuthorID uint `goe:"index"`

	AssigneeID *uint

	IsClosed bool `goe:"default:false;index"`
	IsLocked bool `goe:"default:false"`
}

type Label struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Name        string
	Color       string
	Description string

	RepositoryID uint
}

type Comment struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time

	Body string

	IssueID uint `goe:"index"`

	AuthorID uint `goe:"index"`
}

type Release struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time

	TagName string
	Title   string
	Body    string

	RepositoryID uint

	AuthorID uint

	IsDraft      bool `goe:"default:false"`
	IsPrerelease bool `goe:"default:false"`
}

type Star struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time

	UserID       uint `goe:"uniqueIndex:idx_user_repo"`
	RepositoryID uint `goe:"uniqueIndex:idx_user_repo"`
}

type Watch struct {
	ID        uint `goe:"primaryKey"`
	CreatedAt time.Time

	UserID       uint `goe:"uniqueIndex:idx_user_repo_watch"`
	RepositoryID uint `goe:"uniqueIndex:idx_user_repo_watch"`
}
