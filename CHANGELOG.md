# Changelog

All notable changes to project-nomad will be documented in this file.

## [Unreleased]

## Version 1.32.0 - August 9, 2026

- Added first-boot hardware readiness scoring in Easy Setup, including SSD/SMART health, RAM, GPU VRAM, and actionable installation suggestions.
- Added a System Information health dashboard with per-tool storage, per-container RAM, uptime, and last ZIM update details.
- Added Backup & Restore for Nomad storage and MySQL data, with second-disk archives and optional rclone remote upload/restore.
- Added authenticated Cluster Sync to mirror selected ZIM files and offline map regions between paired N.O.M.A.D. boxes.
- Added Guest Kiosk mode for classroom deployments, with server-side tool allowlisting and no admin UI.
- Added ARM64-first installation and build support, including native architecture detection, ARM64 Dockerfile dependencies, and Jetson-aware NVIDIA setup guidance.
- Added a rootless Podman installation path using the Docker-compatible API, runtime-aware lifecycle helpers, and configurable compatibility sockets.
- Added PWA installability for the Command Center with a home-screen manifest, theme metadata, and a static-asset service worker.
- Added federated search across installed Kiwix, Kolibri, FlatNotes, and Qdrant sources with partial-service status reporting.
- Added BM25 lexical retrieval and dense-vector score fusion for ZIM article chunks indexed in Qdrant.
- Added scheduled Kiwix catalog update checks and one-click in-place ZIM refreshes from the Content Explorer.
- Added Medical, Homestead, Maker, K-12, and HAM Radio starter packs to Easy Setup.
- Added optional persistent npm, PyPI, and Docker Hub pull-through caches for offline development.
- Added hardware-aware Ollama model recommendations for Raspberry Pi 5, Jetson, and x86 NVIDIA systems.
- Added optional Whisper.cpp speech-to-text and Piper text-to-speech services with persistent models and voice data.
- Added clickable ZIM page and section citations to RAG chat responses, with citations preserved in chat history.
- Added browser-scoped chat history and a Private Chat mode that prevents persistence.
- Added optional offline translation with persistent Argos Translate language packs and map/wiki translation panels.

## [v0.0.0] - %Y->- (HEAD -> main)

- docs(release): finalize v1.31.0 release notes [skip ci]
- chore(release): 1.31.0 [skip ci]
- docs: update release notes
- Added: feat(maps): add imperial/metric toggle for scale bar (#641)
- chore(release): 1.31.0-rc.3 [skip ci]
- Added: feat(maps): add scale bar and location markers (#636)
- Fixed: fix(Maps): ensure proper parsing of hostnames (#640)
- chore(release): 1.31.0-rc.2 [skip ci]
- docs: update release notes
- Fixed: fix(downloads): improved handling for large file downloads and user-initiated cancellation (#632)

## Roadmap archive — 2026-08-10 — ROADMAP.md

<details>
<summary>Original roadmap snapshot</summary>

```markdown
# ROADMAP

Project N.O.M.A.D. (upstream, by Crosstalk Solutions) is a Debian-based self-contained offline knowledge server — Kiwix library, Kolibri courses, ProtoMaps, CyberChef, FlatNotes, Ollama chat + Qdrant RAG — orchestrated by a Docker-backed management UI.

Note: this is the upstream project. Ideas below are speculative; the `project-nomad-desktop` fork is where most implementation lives.

## Planned Features

### Content & search

### AI

### Management

### Platform

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
```

</details>
