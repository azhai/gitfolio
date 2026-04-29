#!/bin/bash

BASE_URL="http://localhost:3000/api/v1"

echo "=== 测试 Gitower API ==="
echo ""

echo "1. 健康检查"
curl -s "$BASE_URL/health" | jq .
echo ""

echo "2. 注册新用户"
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }')
echo "$REGISTER_RESPONSE" | jq .
TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r .token)
echo ""

echo "3. 登录测试"
curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }' | jq .
echo ""

echo "4. 获取当前用户信息"
curl -s -X GET "$BASE_URL/user/me" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

echo "5. 创建仓库"
REPO_RESPONSE=$(curl -s -X POST "$BASE_URL/repos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-repo",
    "description": "A test repository",
    "is_private": false
  }')
echo "$REPO_RESPONSE" | jq .
REPO_ID=$(echo "$REPO_RESPONSE" | jq -r .id)
echo ""

echo "6. 获取仓库列表"
curl -s "$BASE_URL/repos" | jq .
echo ""

echo "7. 创建 Issue"
curl -s -X POST "$BASE_URL/testuser/test-repo/issues" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Issue",
    "body": "This is a test issue",
    "labels": ["bug"]
  }' | jq .
echo ""

echo "8. 获取 Issue 列表"
curl -s "$BASE_URL/testuser/test-repo/issues" | jq .
echo ""

echo "=== 测试完成 ==="
