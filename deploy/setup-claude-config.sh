#!/bin/bash
# setup-claude-config.sh
# 컨테이너 시작시 /opt/claude-config/ 스테이징에서 각 CLAUDE_CONFIG_DIR로 동기화
# 기존 credentials (.credentials.json 등)은 보존

set -e

STAGING_DIR="/opt/claude-config"

for config_dir in /data/.claude-viewster /data/.claude-gary; do
  echo "[setup-claude-config] Syncing to $config_dir ..."

  # 디렉토리 생성
  mkdir -p "$config_dir/skills" "$config_dir/plugins/cache"

  # 1. Skills 동기화 (전체 덮어쓰기)
  cp -r "$STAGING_DIR/skills/"* "$config_dir/skills/" 2>/dev/null || true

  # 2. Plugins 캐시 동기화
  cp -r "$STAGING_DIR/plugins/cache/"* "$config_dir/plugins/cache/" 2>/dev/null || true

  # 3. installed_plugins.json - 경로 플레이스홀더를 실제 경로로 치환
  sed "s|__CLAUDE_CONFIG_DIR__|$config_dir|g" \
    "$STAGING_DIR/plugins/installed_plugins.json" \
    > "$config_dir/plugins/installed_plugins.json"

  # 4. known_marketplaces.json - 경로 치환
  sed "s|__CLAUDE_CONFIG_DIR__|$config_dir|g" \
    "$STAGING_DIR/plugins/known_marketplaces.json" \
    > "$config_dir/plugins/known_marketplaces.json"

  # 5. settings.json 머지 (기존 설정 보존, enabledPlugins/env만 업데이트)
  if [ ! -f "$config_dir/settings.json" ] || [ "$(cat "$config_dir/settings.json")" = "{}" ]; then
    cp "$STAGING_DIR/settings.json" "$config_dir/settings.json"
  else
    if command -v jq &>/dev/null; then
      jq -s '.[1] as $new | .[0] * {enabledPlugins: $new.enabledPlugins, env: ((.[0].env // {}) + ($new.env // {}))}' \
        "$config_dir/settings.json" "$STAGING_DIR/settings.json" \
        > "$config_dir/settings.json.tmp" \
        && mv "$config_dir/settings.json.tmp" "$config_dir/settings.json"
    else
      cp "$STAGING_DIR/settings.json" "$config_dir/settings.json"
    fi
  fi

  # 6. 권한 설정 (node 유저가 접근 가능하도록)
  chown -R node:node "$config_dir/skills/" "$config_dir/plugins/" "$config_dir/settings.json" 2>/dev/null || true

  echo "[setup-claude-config] Done syncing to $config_dir"
done

echo "[setup-claude-config] All config directories synced successfully"
