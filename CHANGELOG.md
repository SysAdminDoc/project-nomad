# Changelog

All notable changes to project-nomad will be documented in this file.

## [Unreleased]

- Added first-boot hardware readiness scoring in Easy Setup, including SSD/SMART health, RAM, GPU VRAM, and actionable installation suggestions.
- Added a System Information health dashboard with per-tool storage, per-container RAM, uptime, and last ZIM update details.
- Added Backup & Restore for Nomad storage and MySQL data, with second-disk archives and optional rclone remote upload/restore.
- Added authenticated Cluster Sync to mirror selected ZIM files and offline map regions between paired N.O.M.A.D. boxes.
- Added Guest Kiosk mode for classroom deployments, with server-side tool allowlisting and no admin UI.
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
