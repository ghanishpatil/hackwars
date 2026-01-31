# NGINX — Reverse proxy and hardening

- **TLS**: Configure `listen 443 ssl` and `ssl_certificate` / `ssl_certificate_key` when using HTTPS.
- **Ports**: NGINX listens on 80 (and optionally 443). Backend runs on 3000, Match Engine on 7000 — **do not expose 7000 to the internet**.
- **Rate limit**: `api_limit` zone 20 req/s per IP; adjust in `limit_req_zone` and `limit_req` as needed.
- **Body size**: `client_max_body_size 100k`; increase only if required.
- **Invalid methods**: Returns 405 for non-standard HTTP methods.
