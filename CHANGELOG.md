# Changelog

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.4.0]

### Added
- Dark mode: a sun / moon switch in the top-right corner of every screen; it follows the phone's light / dark setting until switched, and the choice is remembered. In dark mode the Squigglepig artwork gets a teal outline so it stands out from the background
- High contrast mode, in light and dark: solid colors, black or white text and outlined cards; it follows the phone's contrast setting (iOS Increase Contrast, Android High contrast text) and can be switched in the menu under Accessibility
- Reduce motion: the light / dark switch flips without the sweep, and the walkthrough, menu, trough and scoring ✓ / ✗ hold still instead of animating; it follows the phone's Reduce motion setting and can be switched in the menu under Accessibility

### Changed
- Small text, labels, badges and the scoring "+1" are darker or lighter where they were hard to read on the teal (every text color now meets WCAG AA contrast)
- The pink accent is a deeper pink in light mode, so the white text on badges is easier to read
- The lobby's connection light shows a ✓ when connected, a ring while connecting and a ! on a problem, instead of relying on green vs. pink
- The scoring ✓ / ✗ is a solid green or red disc with a white mark, so it reads over any drawing and in any color scheme
- Player initials in the lobby use dark or white lettering, whichever is readable on that player's color
- Cleaner edges on the Squigglepig artwork: the speckled white fringe around the outlines is gone

## [2.3.0]

### Added
- A quick animated walkthrough of how the game works the first time Squigglepig opens; it can be skipped, and once finished or skipped it doesn't come back (app updates don't reset it)
- How to play in the home screen menu replays the walkthrough

### Removed
- "Learn to Squiggle" on the home screen, replaced by the walkthrough

## [2.2.0]

### Added
- Web version of the game at play.squigglepig.app, built from the same code as the apps
- squigglepig.app landing page: "Play on the web" button and Google Play / App Store links
- squigglepig.app invite page: "Play in your browser" button that opens the same room on the web
- On desktop browsers the lobby's share button copies the room link instead
- Web version can be added to the home screen (Android, iOS, desktop Chrome/Edge) with the Squigglepig icon and opens full-screen
- Link previews: squigglepig.app, room invite links and play.squigglepig.app show the Squigglepig card in chats and social apps
- At 2× zoom in a browser, the mouse wheel or a trackpad scroll moves around the canvas
- Menu on the home screen (☰, top-left) with the app version, Send feedback, Rate this app, Help & FAQ, Privacy Policy, Terms of Service, the developer's website and the copyright line; it follows light / dark mode
- Open-source licenses screen listing every open-source package in the app with its license type
- squigglepig.app/help: how to play and answers to common questions
- squigglepig.app/terms: Terms of Service

### Changed
- The snout secret's reward opens the developer's CV on ralanwilliams.com instead of saving a copy

### Removed
- The CV PDF that was bundled with the app

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
