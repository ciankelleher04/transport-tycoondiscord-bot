# Operations notes

## Transport Tycoon API transport

The configured Transport Tycoon status endpoints in `utils/tycoon.js` use
HTTP intentionally. The provider previously served an expired HTTPS
certificate, so requests must not be changed back to HTTPS until that
certificate is confirmed valid.

The bot no longer configures an Undici dispatcher that disables certificate
verification. Remove `TYCOON_ALLOW_INVALID_CERT` from the production `.env`
file; changing repository code does not modify an existing `.env` on the
home Proxmox server or VPS. If a future endpoint uses HTTPS, normal
certificate verification will remain enabled.

## Persistent SOTD cache

The bot stores the confirmed daily SOTD in `/data/sotd.json` using an atomic
temporary-file rename. The Docker Compose bind mount must remain in place.
This repository does not configure synchronization between the home-primary
and VPS-failover hosts, so the `/data` directory must be replicated by the
existing host failover process or the standby will perform a fresh API refresh
after taking over.

Automatic SOTD retrieval runs only at 00:15, 00:45, and 01:15 UTC. The first
successful request ends automatic retrieval for that day. Each scheduled round
tries the preferred API endpoint first and uses the second endpoint only if the
first fails, so the maximum is 3 rounds x 2 HTTP requests = 6 requests per
SOTD day. XP cache reads do not contact the API, and manual administrator
refreshes are bounded to the same two endpoint attempts per invocation.
