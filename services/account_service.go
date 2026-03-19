package services

import (
	"fmt"
	"time"

	"github.com/azhai/gitfolio/database"
	"github.com/azhai/gitfolio/models"
)

type AccountService struct {
	db *database.Database
}

func NewAccountService(db *database.Database) *AccountService {
	return &AccountService{db: db}
}

func (s *AccountService) CreateOrUpdateAccount(platform, username, email, avatarURL, apiURL string, userID uint) (*models.PlatformAccount, error) {
	accounts, err := s.db.PlatformAccount.Select().Where("platform = ? AND username = ?", platform, username).All()
	if err != nil {
		return nil, err
	}

	var account models.PlatformAccount
	if len(accounts) > 0 {
		account = *accounts[0]
		account.Email = email
		account.AvatarURL = avatarURL
		account.APIURL = apiURL
		account.IsActive = true
		account.UpdatedAt = time.Now()
		if err := s.db.PlatformAccount.Save().One(&account); err != nil {
			return nil, err
		}
	} else {
		account = models.PlatformAccount{
			Platform:  platform,
			Username:  username,
			Email:     email,
			AvatarURL: avatarURL,
			APIURL:    apiURL,
			UserID:    userID,
			IsActive:  true,
		}
		if err := s.db.PlatformAccount.Insert().One(&account); err != nil {
			return nil, err
		}
	}

	return &account, nil
}

func (s *AccountService) CreateOrUpdateToken(platform, name, accessToken, refreshToken, tokenType string, expiresAt *time.Time, scopes string, accountID uint, repoID *uint) (*models.SyncToken, error) {
	tokens, err := s.db.SyncToken.Select().Where("platform = ? AND account_id = ? AND name = ?", platform, accountID, name).All()
	if err != nil {
		return nil, err
	}

	var token models.SyncToken
	if len(tokens) > 0 {
		token = *tokens[0]
		token.AccessToken = accessToken
		token.RefreshToken = refreshToken
		token.TokenType = tokenType
		token.ExpiresAt = expiresAt
		token.Scopes = scopes
		token.IsActive = true
		token.UpdatedAt = time.Now()
		if repoID != nil {
			token.RepositoryID = repoID
		}
		if err := s.db.SyncToken.Save().One(&token); err != nil {
			return nil, err
		}
	} else {
		token = models.SyncToken{
			Platform:     platform,
			Name:         name,
			AccessToken:  accessToken,
			RefreshToken: refreshToken,
			TokenType:    tokenType,
			ExpiresAt:    expiresAt,
			Scopes:       scopes,
			AccountID:    accountID,
			RepositoryID: repoID,
			IsActive:     true,
		}
		if err := s.db.SyncToken.Insert().One(&token); err != nil {
			return nil, err
		}
	}

	return &token, nil
}

func (s *AccountService) GetAccountByPlatform(platform, username string) (*models.PlatformAccount, error) {
	accounts, err := s.db.PlatformAccount.Select().Where("platform = ? AND username = ?", platform, username).All()
	if err != nil {
		return nil, err
	}
	if len(accounts) == 0 {
		return nil, fmt.Errorf("account not found")
	}
	return accounts[0], nil
}

func (s *AccountService) GetTokenByAccount(accountID uint) (*models.SyncToken, error) {
	tokens, err := s.db.SyncToken.Select().Where("account_id = ? AND is_active = ?", accountID, true).All()
	if err != nil {
		return nil, err
	}
	if len(tokens) == 0 {
		return nil, fmt.Errorf("token not found")
	}
	return tokens[0], nil
}

func (s *AccountService) ListAccounts(userID uint) ([]*models.PlatformAccount, error) {
	return s.db.PlatformAccount.Select().Where("user_id = ?", userID).All()
}

func (s *AccountService) DeleteAccount(accountID uint) error {
	return s.db.PlatformAccount.Delete().Where("id = ?", accountID).Exec()
}

func (s *AccountService) DeactivateToken(tokenID uint) error {
	tokens, err := s.db.SyncToken.Select().Where("id = ?", tokenID).All()
	if err != nil {
		return err
	}
	if len(tokens) == 0 {
		return fmt.Errorf("token not found")
	}
	token := *tokens[0]
	token.IsActive = false
	token.UpdatedAt = time.Now()
	return s.db.SyncToken.Save().One(&token)
}
