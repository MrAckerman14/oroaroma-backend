#!/usr/bin/env bash
set -Eeuo pipefail

readonly ROOT=/opt/oroaroma-testing
readonly STATE_DIR="$ROOT/deploy-state"
readonly SOURCE_DIR="$ROOT/sources"
readonly BACKEND_REPO=https://github.com/MrAckerman14/oroaroma-backend.git
readonly FRONTEND_REPO=git@github.com:MrAckerman14/oroaroma-admin-frontend.git
readonly BRANCH=testing
readonly GITHUB_API=https://api.github.com
readonly MAX_RELEASES=5

mkdir -p "$STATE_DIR" "$SOURCE_DIR" "$ROOT/backups" "$ROOT/frontend/releases"
exec 9>"$STATE_DIR/deploy.lock"
flock -n 9 || exit 0

log() {
  printf '%s %s\n' "$(date --iso-8601=seconds)" "$*"
}

sync_repo() {
  local name=$1
  local url=$2
  local destination="$SOURCE_DIR/$name"

  if [[ ! -d "$destination/.git" ]]; then
    if [[ "$name" == frontend ]]; then
      GIT_SSH_COMMAND='ssh -i /root/.ssh/oroaroma_frontend_deploy -o IdentitiesOnly=yes' \
        git clone --branch "$BRANCH" --single-branch "$url" "$destination"
    else
      git clone --branch "$BRANCH" --single-branch "$url" "$destination"
    fi
  fi

  if [[ "$name" == frontend ]]; then
    GIT_SSH_COMMAND='ssh -i /root/.ssh/oroaroma_frontend_deploy -o IdentitiesOnly=yes' \
      git -C "$destination" fetch origin "$BRANCH" --prune
  else
    git -C "$destination" fetch origin "$BRANCH" --prune
  fi
}

remote_sha() {
  git -C "$SOURCE_DIR/$1" rev-parse "origin/$BRANCH"
}

ci_succeeded() {
  local repository=$1
  local sha=$2
  local response

  response=$(curl --fail --silent --show-error \
    -H 'Accept: application/vnd.github+json' \
    "$GITHUB_API/repos/MrAckerman14/$repository/actions/runs?branch=$BRANCH&head_sha=$sha&event=push&per_page=20")

  CI_RESPONSE="$response" python3 - <<'PY'
import json
import os
import sys

runs = json.loads(os.environ["CI_RESPONSE"]).get("workflow_runs", [])
matching = [run for run in runs if run.get("name") == "CI"]
sys.exit(0 if matching and matching[0].get("status") == "completed" and matching[0].get("conclusion") == "success" else 1)
PY
}

deploy_backend() {
  local sha=$1
  local source="$SOURCE_DIR/backend"
  local current_image
  local backup="$ROOT/backups/testing-pre-deploy-$(date -u +%Y%m%dT%H%M%SZ).dump"

  log "Deploying backend $sha"
  git -C "$source" reset --hard "$sha"
  docker exec oroaroma-v2-postgres pg_dump \
    --username=oroaroma_testing --dbname=oroaroma_testing --format=custom --file=/tmp/pre-deploy.dump
  docker cp oroaroma-v2-postgres:/tmp/pre-deploy.dump "$backup"
  docker exec oroaroma-v2-postgres rm -f /tmp/pre-deploy.dump

  current_image=$(docker inspect oroaroma-v2-api --format '{{.Image}}' 2>/dev/null || true)
  if [[ -n "$current_image" ]]; then
    docker image tag "$current_image" oroaroma-backend:rollback
  fi

  docker compose --project-name backend \
    --env-file "$ROOT/backend/.env" \
    --file "$source/docker-compose.yml" \
    up --detach --build --remove-orphans

  for _ in $(seq 1 30); do
    if curl --fail --silent http://127.0.0.1:3300/health >/dev/null; then
      printf '%s\n' "$sha" > "$STATE_DIR/backend.sha"
      log "Backend $sha is healthy"
      return 0
    fi
    sleep 2
  done

  log "Backend health check failed"
  return 1
}

deploy_frontend() {
  local sha=$1
  local source="$SOURCE_DIR/frontend"
  local release="$ROOT/frontend/releases/$sha"
  local previous

  log "Deploying frontend $sha"
  git -C "$source" reset --hard "$sha"
  docker run --rm \
    --volume "$source:/app" \
    --workdir /app \
    node:22-alpine \
    sh -lc 'npm ci && npm run build'

  mkdir -p "$release"
  cp -a "$source/dist/spa/." "$release/"
  find "$release" -type d -exec chmod 755 {} +
  find "$release" -type f -exec chmod 644 {} +
  previous=$(readlink -f "$ROOT/frontend/current" 2>/dev/null || true)
  ln -sfn "$release" "$ROOT/frontend/current.new"
  mv -Tf "$ROOT/frontend/current.new" "$ROOT/frontend/current"

  if ! nginx -t || ! curl --fail --silent --resolve oroaroma-testing.protostages.com:443:127.0.0.1 \
    https://oroaroma-testing.protostages.com/ >/dev/null; then
    if [[ -n "$previous" && -d "$previous" ]]; then
      ln -sfn "$previous" "$ROOT/frontend/current.new"
      mv -Tf "$ROOT/frontend/current.new" "$ROOT/frontend/current"
    fi
    log "Frontend validation failed; previous release restored"
    return 1
  fi

  printf '%s\n' "$sha" > "$STATE_DIR/frontend.sha"
  find "$ROOT/frontend/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
    | sort -nr | tail -n +$((MAX_RELEASES + 1)) | cut -d' ' -f2- | xargs -r rm -rf --
  log "Frontend $sha is active"
}

process_component() {
  local component=$1
  local repository=$2
  local url=$3
  local require_remote_ci=$4
  local sha
  local deployed=''

  if ! sync_repo "$component" "$url"; then
    log "$component cannot fetch its testing branch yet"
    return 0
  fi
  sha=$(remote_sha "$component")
  [[ -f "$STATE_DIR/$component.sha" ]] && deployed=$(<"$STATE_DIR/$component.sha")
  [[ "$sha" == "$deployed" ]] && return 0

  if [[ "$require_remote_ci" == yes ]] && ! ci_succeeded "$repository" "$sha"; then
    log "$component $sha is waiting for successful CI"
    return 0
  fi

  "deploy_$component" "$sha"
}

process_component backend oroaroma-backend "$BACKEND_REPO" yes
process_component frontend oroaroma-admin-frontend "$FRONTEND_REPO" no
