# ROADMAP

Project N.O.M.A.D. (upstream, by Crosstalk Solutions) is a Debian-based self-contained offline knowledge server — Kiwix library, Kolibri courses, ProtoMaps, CyberChef, FlatNotes, Ollama chat + Qdrant RAG — orchestrated by a Docker-backed management UI.

Note: this is the upstream project. Ideas below are speculative; the `project-nomad-desktop` fork is where most implementation lives.

## Planned Features

### Content & search
- Cross-tool federated search bar — one query that hits Kiwix, Kolibri, FlatNotes, and Qdrant, with a unified result list
- BM25 + dense-vector hybrid across Kiwix ZIMs using Qdrant (today Qdrant is chat-only)
- ZIM auto-update check + one-click refresh from library.kiwix.org metadata feed
- Curated starter packs (Medical / Homestead / Maker / K-12 / HAM radio) installable from the setup wizard
- Offline npm / PyPI / Docker Hub caches for air-gapped developer scenarios

### AI
- Model catalog with device-aware recommendations (Pi 5 vs. Jetson vs. x86 + RTX)
- Speech-to-text (Whisper.cpp) and text-to-speech (Piper) as optional containers
- Document citation render — every RAG answer shows ZIM page + paragraph link
- Per-user chat history with privacy toggle
- Local translation (NLLB or similar) for the offline maps and wikis

### Management
- First-boot hardware scoring built into the setup wizard (SSD health, RAM, GPU VRAM) with suggestions
- Health dashboard: disk usage by tool, RAM per container, uptime, last ZIM update
- Backup/restore of entire install to a second disk or rclone remote
- Cluster mode — pair two N.O.M.A.D. boxes to mirror a chosen content subset
- Guest kiosk mode for classroom deployments (no admin UI, locked to specific tools)

### Platform
- ARM64 first-class support (Raspberry Pi 5, Orange Pi, Jetson)
- Rootless podman path as an alternative to Docker
- PWA-installable Command Center so tablets can pin it to the home screen

## Competitive Research

- **Internet-in-a-Box** (IIAB) — Mature OSS offline content server; richer content catalog but dated UX. Catalog curation is the area to match.
- **Kolibri / Kiwix** — The content engines N.O.M.A.D. embeds. Watch their roadmaps for features worth surfacing
- **AnythingLLM / LibreChat / Open WebUI** — Self-hosted chat front-ends; Command Center chat UX should meet their bar
- **LibraryBox / PirateBox** — Historical predecessors; reminder that portable/battery use cases matter

## Nice-to-Haves

- Mesh networking (B.A.T.M.A.N.-adv or Yggdrasil) for multi-node content sharing without internet
- Starlink / cellular failover logic so the box is useful when online but doesn't depend on it
- Public-safety integrations: AREDN mesh bridge, APRS-IS gateway, NOAA weather feed cache
- Built-in CaddyServer reverse proxy with Let's Encrypt when online, self-signed when offline
- Benchmark leaderboard enriched with power-consumption per score (W/benchmark-point)

## Open-Source Research (Round 2)

### Related OSS Projects
- https://github.com/reidwallace/prepperpi — PrepperPi, Pi-focused offline knowledge server with Wi-Fi hotspot, Kiwix, medical/survival ZIMs, responsive dashboard, WPA3 + MAC filtering, auto backup
- https://github.com/kiwix/kiwix-tools — Kiwix server suite (kiwix-serve, zimdump, zimcheck) — the canonical ZIM-serving stack NOMAD already relies on
- https://github.com/kiwix/kiwix-hotspot — official Kiwix hotspot image builder for Pi-class devices; reference for the "plug in, broadcast SSID, serve library" pattern
- https://github.com/akhenakh/gozim — Go-based ZIM server, single-binary alternative to kiwix-serve with lower resource footprint
- https://github.com/learningequality/kolibri — Kolibri learning platform (already a NOMAD service) — upstream patterns for course sync and offline-first delivery
- https://github.com/iiab/iiab — Internet-in-a-Box, the long-standing OSS precedent for this category; dense catalog of services and deployment scripts worth mining
- https://github.com/protomaps/protomaps-leaflet — ProtoMaps offline tile serving; reference for the mapping subsystem
- https://github.com/ollama/ollama — Ollama local inference; referenced by the fork for RAG chat

### Features to Borrow
- Wi-Fi hotspot + captive portal in the stock build (PrepperPi) — turn the box into a self-contained library without any external network; complements the existing Caddy reverse-proxy item
- WPA3 + MAC filtering defaults (PrepperPi) — harden hotspot out of the box; many deployments end up on shared networks
- Hotspot-image builder (kiwix-hotspot) — publish prebuilt SD card images per supported SBC so users go from hardware to running NOMAD without a terminal session
- Lightweight Go server variant (gozim) — evaluate bundling gozim alongside kiwix-serve for memory-constrained edge deployments (Pi Zero 2 W tier)
- Service-health dashboard (PrepperPi's real-time CPU/mem/temp view) — surface inside the NOMAD management UI so deployers see when they're CPU-bound on inference vs disk-bound on ZIM serving
- Canonical content manifests for common disaster scenarios — "Medical kit", "Hurricane response", "Grid-down comms" — each a one-click install combining curated ZIMs + Kolibri channels + RAG corpora
- Power-aware benchmark leaderboard (W/point) — already on the roadmap; cross-reference against PrepperPi-tier Pi builds to show energy floor

### Patterns & Architectures Worth Studying
- Service-bundle modularity (IIAB, NOMAD) — each service as a standalone, independently upgradable unit; critical for a project this big to avoid upgrade deadlock
- Content catalog + RAG corpus split (NOMAD's existing architecture) — keep Kiwix ZIMs immutable and rely on the RAG index for mutable, deployer-specific documents; worth documenting as a formal contract
- Offline-first + optional-online hybrid — Caddy with Let's Encrypt when online, self-signed when offline (already on roadmap) is the correct pattern; study how Kolibri's sync handles intermittent connectivity for inspiration on NOMAD-to-NOMAD content propagation
- Hardware tier matrix (PrepperPi Pi-class → NOMAD Ubuntu → GPU rig) — document which features are available at each tier so deployers pick the right hardware for their use case without surprise
