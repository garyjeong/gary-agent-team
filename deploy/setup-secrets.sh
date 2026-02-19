#!/bin/bash
# OpenClaw Gateway - Secrets 설정 스크립트
# 사용법: ./setup-secrets.sh
#
# 주의: 이 스크립트를 실행하기 전에 아래 값을 실제 값으로 교체하세요.
# 절대 이 파일에 실제 키를 저장한 채로 커밋하지 마세요.

set -e

APP_NAME="gary-openclaw-gateway"

echo "=== OpenClaw Gateway Secrets 설정 ==="
echo ""

# Gateway 인증 토큰 자동 생성
GATEWAY_TOKEN=$(openssl rand -hex 32)
echo "Generated GATEWAY_AUTH_TOKEN: ${GATEWAY_TOKEN:0:8}..."

# Secrets 설정
fly secrets set -a "$APP_NAME" \
  GATEWAY_AUTH_TOKEN="$GATEWAY_TOKEN"

echo ""
echo "=== 아래 시크릿은 수동으로 설정하세요 ==="
echo ""
echo "# Telegram 봇 토큰"
echo "fly secrets set -a $APP_NAME TELEGRAM_BOT_TOKEN=\"<YOUR_TELEGRAM_BOT_TOKEN>\""
echo ""
echo "# GitHub PAT (Viewstream2025 + garyjeong 접근 가능한 토큰)"
echo "fly secrets set -a $APP_NAME GITHUB_TOKEN=\"<YOUR_GITHUB_PAT>\""
echo ""
echo "# Gemini API Key"
echo "fly secrets set -a $APP_NAME GEMINI_API_KEY=\"<YOUR_GEMINI_API_KEY>\""
echo ""
echo "# Claude Code 인증 (아래 가이드 참조)"
echo "# fly ssh console -a $APP_NAME"
echo "# claude login  (Fly.io VM 내부에서 실행)"
echo ""
echo "=== 완료 ==="
