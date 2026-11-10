#!/usr/bin/env bash
# Despliega en la VPS de testing lo último de la rama testing (con CI en verde)
# y muestra el resultado. Se corre desde la máquina del desarrollador.
#
#   ./ops/deploy/push-to-testing.sh             despliega y muestra el estado
#   ./ops/deploy/push-to-testing.sh --status    solo muestra el estado
#
# La primera vez crea una llave SSH propia y la autoriza en la VPS
# (pide la contraseña de root una sola vez).
set -Eeuo pipefail

readonly VPS_HOST=${VPS_HOST:-177.7.45.94}
readonly VPS_USER=${VPS_USER:-root}
readonly SSH_KEY=${SSH_KEY:-$HOME/.ssh/oroaroma_testing}
readonly REMOTE_ROOT=/opt/oroaroma-testing
readonly SERVICE=oroaroma-testing-deploy.service

SSH=(ssh -i "$SSH_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 "$VPS_USER@$VPS_HOST")

log() { printf '\n==> %s\n' "$*"; }

ensure_key() {
  [[ -f "$SSH_KEY" ]] && return 0
  log "Creando llave SSH en $SSH_KEY"
  mkdir -p "$(dirname "$SSH_KEY")"
  chmod 700 "$(dirname "$SSH_KEY")"
  ssh-keygen -q -t ed25519 -N '' -C "deploy-oroaroma-testing@$(hostname)" -f "$SSH_KEY"
}

ensure_access() {
  if "${SSH[@]}" -o BatchMode=yes true 2>/dev/null; then
    return 0
  fi
  log "Autorizando la llave en $VPS_USER@$VPS_HOST (pedirá la contraseña una vez)"
  if command -v ssh-copy-id >/dev/null; then
    ssh-copy-id -i "$SSH_KEY.pub" -o StrictHostKeyChecking=accept-new "$VPS_USER@$VPS_HOST"
  else
    ssh -o StrictHostKeyChecking=accept-new "$VPS_USER@$VPS_HOST" \
      'umask 077; mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys' < "$SSH_KEY.pub"
  fi
  "${SSH[@]}" -o BatchMode=yes true
}

remote_status() {
  "${SSH[@]}" bash -s <<EOF
set -u
echo "Backend desplegado:  \$(cat $REMOTE_ROOT/deploy-state/backend.sha 2>/dev/null || echo '-')"
echo "Frontend desplegado: \$(cat $REMOTE_ROOT/deploy-state/frontend.sha 2>/dev/null || echo '-')"
if curl --fail --silent http://127.0.0.1:3300/health >/dev/null; then echo "API: responde"; else echo "API: NO responde"; fi
echo
journalctl -u $SERVICE -n 15 --no-pager -o cat 2>/dev/null || true
EOF
}

remote_deploy() {
  "${SSH[@]}" bash -s <<EOF
set -Eeuo pipefail
env_file=$REMOTE_ROOT/backend/.env
# Clave para cifrar las credenciales del proveedor de facturación (solo se crea una vez).
if [[ -f "\$env_file" ]] && ! grep -q '^FISCAL_SECRET_KEY=.\+' "\$env_file"; then
  sed -i '/^FISCAL_SECRET_KEY=/d' "\$env_file"
  printf 'FISCAL_SECRET_KEY=%s\n' "\$(openssl rand -hex 32)" >> "\$env_file"
  echo "FISCAL_SECRET_KEY agregada a \$env_file"
fi
echo "Ejecutando el despliegue (respaldo de la base, build y verificación)..."
systemctl start $SERVICE
EOF
}

main() {
  ensure_key
  ensure_access
  if [[ "${1:-}" != --status ]]; then
    log "Desplegando lo último de testing en $VPS_HOST"
    remote_deploy
  fi
  log "Estado"
  remote_status
}

main "$@"
