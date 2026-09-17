#!/bin/sh
# ============================================================
# Configuration déclarative de Kong via son Admin API.
# Idempotent : chaque service/route utilise PUT (créé ou mis à jour à l'identique).
# Exécuté automatiquement par le service "kong-setup" au démarrage de la stack.
# ============================================================
set -e

ADMIN=http://kong:8001

# IP ou domaine par lequel la machine sera jointe une fois déployée ("localhost" en dev).
# Pilote les origines CORS supplémentaires et les routes Blockscout dédiées ci-dessous —
# voir docs/04-DEPLOIEMENT-PRODUCTION.md §2bis (déploiement par IP, sans nom de domaine).
DEPLOY_HOST="${DEPLOY_HOST:-localhost}"

put() {
  path="$1"
  data="$2"
  curl -s -o /dev/null -w "  %{http_code} PUT $path\n" \
    -X PUT "$ADMIN$path" \
    -H "Content-Type: application/json" \
    -d "$data"
}

echo "== Services/Routes =="

# --- Frontend (SPA React) : route "catch-all", Kong priorise automatiquement les chemins
# plus spécifiques (/api, /ws, /ipfs) ci-dessous, donc pas de conflit malgré le "/" large.
put "/services/frontend-app" '{"url":"http://frontend:80"}'
put "/services/frontend-app/routes/frontend-app-route" '{"paths":["/"],"strip_path":false,"protocols":["http","https"]}'

# --- Backend API (REST) : Kong strippe /api, le backend ne connaît pas ce préfixe ---
# Pas de nom d'hôte dédié pour l'instant (localhost nu) : en attendant le vrai domaine de
# production, on reste sur la config d'origine. À réintroduire (host-based routing) une fois
# le DNS en place.
put "/services/backend-api" '{"url":"http://backend:8000"}'
put "/services/backend-api/routes/backend-api-route" '{"paths":["/api"],"strip_path":true,"protocols":["http","https"]}'

# --- Backend WebSocket : le backend attend déjà /ws/{user_id}, donc pas de strip ---
put "/services/backend-ws" '{"url":"http://backend:8000"}'
put "/services/backend-ws/routes/backend-ws-route" '{"paths":["/ws"],"strip_path":false,"protocols":["http","https"]}'

# --- IPFS Gateway (lecture seule) : le chemin /ipfs/<cid> est déjà celui attendu par Kubo ---
put "/services/ipfs-gateway" '{"url":"http://ipfs:8080"}'
put "/services/ipfs-gateway/routes/ipfs-gateway-route" '{"paths":["/ipfs"],"strip_path":false,"protocols":["http","https"]}'

# --- Blockscout (routage par nom d'hôte, cf. docker-compose.yml pour le pourquoi) ---
# Deux hôtes enregistrés sur chaque route dès que DEPLOY_HOST diffère de "localhost" :
# "explorer.localhost" (résolution native en dev, toujours fonctionnelle) et
# "explorer.$DEPLOY_HOST" (utile une fois DEPLOY_HOST réglé sur l'IP/le domaine réel de
# déploiement — un nom comme "explorer.192.168.1.50" ne se résout par aucun DNS automatique,
# mais fonctionne dès qu'une entrée hosts locale le pointe vers cette IP, côté client).
UI_HOSTS="\"explorer.localhost\""
API_HOSTS="\"explorer-api.localhost\""
if [ "$DEPLOY_HOST" != "localhost" ]; then
  UI_HOSTS="$UI_HOSTS,\"explorer.$DEPLOY_HOST\""
  API_HOSTS="$API_HOSTS,\"explorer-api.$DEPLOY_HOST\""
fi

put "/services/blockscout-ui" '{"url":"http://blockscout-frontend:3000"}'
put "/services/blockscout-ui/routes/blockscout-ui-route" "{\"hosts\":[$UI_HOSTS],\"strip_path\":false,\"protocols\":[\"http\",\"https\"]}"

put "/services/blockscout-api" '{"url":"http://blockscout:4000"}'
put "/services/blockscout-api/routes/blockscout-api-route" "{\"hosts\":[$API_HOSTS],\"strip_path\":false,\"protocols\":[\"http\",\"https\"]}"

echo "== Plugins globaux =="

# CORS : le frontend est désormais servi par Kong lui-même (même origine que l'API,
# http://<DEPLOY_HOST>:8000) donc plus besoin d'autoriser :3000 ; gardé pour l'explorateur
# (nom d'hôte différent) et pour un éventuel accès direct pendant le développement.
ORIGINS="\"http://localhost:8000\",\"http://explorer.localhost:8000\""
if [ "$DEPLOY_HOST" != "localhost" ]; then
  # Autorise l'appel direct à l'API depuis l'IP/le domaine réel de déploiement (ex: un futur
  # client web séparé, ou des tests cross-origin) — sans effet sur l'usage normal de l'app,
  # qui appelle l'API en URL relative (même origine, jamais soumise au CORS).
  ORIGINS="$ORIGINS,\"http://$DEPLOY_HOST:8000\",\"https://$DEPLOY_HOST:8443\""
fi

put "/plugins/cors-global" "{
  \"id\":\"11111111-1111-1111-1111-111111111111\",
  \"name\":\"cors\",
  \"config\":{
    \"origins\":[$ORIGINS],
    \"methods\":[\"GET\",\"POST\",\"PUT\",\"PATCH\",\"DELETE\",\"OPTIONS\"],
    \"headers\":[\"Authorization\",\"Content-Type\",\"Accept\"],
    \"credentials\":true,
    \"max_age\":3600
  }
}"

# Rate limiting : protection anti-abus basique sur l'ensemble du trafic proxifié
put "/plugins/rate-limiting-global" '{
  "id":"22222222-2222-2222-2222-222222222222",
  "name":"rate-limiting",
  "config":{
    "minute":300,
    "policy":"local"
  }
}'

echo "== Kong configuré =="
