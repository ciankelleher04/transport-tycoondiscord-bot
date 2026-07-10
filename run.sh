#!/usr/bin/with-contenv bashio

export TOKEN="$(bashio::config 'discord_token')"
export DISCORD_TOKEN="$(bashio::config 'discord_token')"
export CLIENT_ID="$(bashio::config 'client_id')"

echo "TOKEN length: ${#TOKEN}"
echo "CLIENT_ID: $CLIENT_ID"

cd /app

if [ -f "deploy-commands.js" ]; then
  node deploy-commands.js
fi

node index.js