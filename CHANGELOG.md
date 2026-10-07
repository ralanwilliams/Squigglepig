# Changelog

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Web version of the game at play.squigglepig.app, built from the same code as the apps
- squigglepig.app landing page: "Play on the web" button and Google Play / App Store links
- squigglepig.app invite page: "Play in your browser" button that opens the same room on the web
- On desktop browsers the lobby's share button copies the room link instead

## [2.1.1] - 2026-10-06

### Changed
- Updated placeholder texts
- Swapped out image for "Your chain" page

## [2.1.0] - 2026-10-05

### Added
- "Share Room Link" button in the lobby sends an invite through any messaging app on the phone (SMS, Signal, Messenger, etc.); the room code is included in the message too
- Tapping a room link opens Squigglepig on the join screen with the room code and your last username filled in (Android; iOS to follow)
- squigglepig.app invite page for anyone without the app: shows the room code, an "Open in Squigglepig" button, and a Google Play link

## [2.0.0] - 2026-09-10

### Changed
- **Complete rebuild as mobile-first app** — migrated from web-based version to native mobile using Expo and React Native
- Redesigned UI for touch input and mobile viewports
- Rebuilt backend on Supabase for real-time multiplayer support
- Simplified game logic for mobile constraints (screen size, network, battery)

### Added
- 1× / 2× switch on the drawing canvas; at 2× a minimap shows the visible window
- Two-finger slide moves the window at 2×; tapping or dragging the minimap jumps it
- A one-time hint teaches the two-finger slide the first time 2× is switched on
- Taps now draw dots
- Dark mode support across all screens
- Real-time game state sync with Supabase
- Proper safe-area handling for notched and edge-to-edge phones
- Responsive scaling that works across phone sizes and orientations
- Game state persistence (resume interrupted games)
- Audio feedback for game events

### Fixed
- Endgame logic cleaned up and simplified
- Game flow state machine made reliable for multiplayer context

### Removed
- Previous web-based deployment
- Legacy drawing format (now uses optimized vector strokes)
