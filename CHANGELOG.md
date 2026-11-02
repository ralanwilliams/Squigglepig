# Changelog

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.6.0]

### Added
- Play Solo on the home screen: a solo arcade of quick games played in runs of 10 rounds. Win rounds in a row to climb the pig slider — 3 wins earns a common reward, 6 a rare one and all 10 a premium one. When a win reaches a new tier, choose to bank the reward or risk it on the next round; a wrong answer or the clock running out loses it. The start screen shows the rewards on a marble podium, and a finished run lets you pick your prize
- Trivia: the pig holds each question up on a board. Questions come from the Open Trivia Database and are kept on the phone between runs, with a pack of our own when it can't be reached
- Draw from memory: a drawing flashes up and hides, then you draw it from memory. The one shown comes back as a ghost over yours to score the match. Later rounds flash the drawing for less time and need a closer match
- Truffle Hunter: tap every truffle on a forest floor before the clock runs out, and a little pig trots over to snuffle each one up. Later rounds bring more truffles, smaller and harder to spot, with more leaves, twigs and look-alike stones
- Pigpen: swipe the pig through a freshly made maze, from the gate to the basket of apples, before the clock runs out. The mazes get bigger as the run goes on
- Truffle Hunter and Pigpen fill the screen, count in with 3, 2, 1, Go! before each round, and turn to night in dark mode
- Truffle Hunter's endless hunt, for younger players: switched on from any round, with no clock and no prizes. Level 1 hides one truffle, level 2 two, and so on with no end, and a slider sets how well hidden they are, from Easy to Very tricky
- Play time for the endless hunt: a grown-up can choose 10, 15, 20 or 30 minutes, and the time left shows beside the level. When it's up, "This piggy needs a rest! Thanks for playing!" comes up and the game ends on its own, so the game says when to stop
- A padlock in the endless hunt locks the screen for a child: only the truffles can be tapped, and Leave, the settings and the back button go away. On Android the app asks to pin itself; on an iPhone it suggests Guided Access. Holding the padlock for 3 seconds unlocks it. If the play time runs out while it's locked, going back in finds the piggy still resting until a grown-up unlocks it
- Rewards, won by playing solo and never bought: 8 brush colors, 4 sticker packs (Eyes, Mouths, Hats and Characters), 3 themes (Railroad, Paul and Bobby), 6 outfits for your pig (a crown, a top hat, a cowboy hat, a chef's hat, sunglasses and a bow tie) and 5 speech bubbles. They're kept on the phone and listed in the menu under Rewards
- Colored brushes: once you've won some, pick the ink from the top-left corner of the canvas
- Stickers: once you've won a pack, stamp its stickers onto your drawing, then move, resize, turn or remove them
- Your pig: dress your pig in the outfits you've won, plus pieces of the holiday in season and the themes you've won, and give it a speech bubble saying whatever you like. When you win a game, everyone in the room sees your pig on the scoreboard; a tie lines up every winner's pig
- Themes you've won can be chosen in the menu under Rewards › Themes, beside the switch for seasonal themes

### Changed
- Drawings can now carry colors and stickers. Players on an older version of the app still see them, in black and without the stickers
- In dark mode the pigs and the Squigglepig artwork have a light border instead of the teal outline, so they stand out from any background
- The menu is grouped into Support, Accessibility and Rewards
- The web version, when added to the home screen, has black status and navigation bars

## [2.5.0]

### Added
- Seasonal themes: the app dresses up for New Year, Groundhog Day, Valentine's Day, St. Patrick's Day, Easter, Spring, the 4th of July, Halloween, Thanksgiving and Christmas, each with its own light and dark colors and the pig dressed to match — a witch's hat, a Santa hat, bunny-white ears, Cupid's quiver and bow — with props around it (bats and a jack-o'-lantern, falling leaves and a turkey, snowflakes and a present, fireworks…). Easter and Thanksgiving follow their dates each year
- Birthday theme: on a listed birthday the pig wears a party hat under balloons and holds up a cake with the person's name iced on top, sparklers fizzing. Birthdays are listed in a Supabase table, so adding one needs no app update
- In a seasonal theme the trough fills with a pile instead of mud — whatever the pig is holding, presents on a birthday, painted eggs at Easter, unlit fireworks on the 4th of July, champagne at New Year, gold coins on St. Patrick's Day. Each one drops in from the top of the screen as a prompt is added and lands any which way, and when the trough is full a shower of extras fills it to the brim
- Seasonal themes are on by default and can be switched off in the menu under Accessibility. High contrast keeps its own colors and shows only the decorations

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
