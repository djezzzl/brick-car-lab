# 🧱 Brick Car Lab

A browser game for kids: build a LEGO-like car, then test it on tracks while live
physics explains **speed**, **acceleration** (speed increment per second) and **forces**.
It runs entirely in the browser: no server, no build, no dependencies.

**Play:** open `index.html` in a browser (double-click works).
**Tests:** open `tests.html`. It shows pass/fail and a survey of how each preset car does on each track.

## How to play

1. **Garage.** Pick a part (plastic, foam, or metal bricks, windows, spoiler, and one of four
   engines) and click the grid to place it. Right-click or use the 🧽 to remove a part.
   The bottom row is the chassis, and the wheels attach at its two ends. Choose wheels
   (small to monster), tyres (slick or knobbly), suspension (low to super high) and axle width.
2. **📊 Your car** shows weight, power, power per kg, top speed, 0–100 km/h, braking,
   clearance, centre of mass, tip-over limit and grip. Hover any row to see what it means.
3. **💡 Tips** checks your car against the track you choose (✅/⚠️) and lists what to watch out for.
4. **Drive.** Press → or GAS to go and ← or BRAKE to slow down. Hold BRAKE while stopped to reverse.
   Space pauses, R restarts, and 🐢 turns on slow motion. ➡️ shows the force arrows
   (push, air drag, brake, gravity, scrape).

## Tracks and what they teach

| Track | Challenge | Physics |
|---|---|---|
| 🏎️ Speed Strip | 300 m drag race | a = F ÷ m; air drag grows with v², which sets the top speed |
| 🛑 Full Stop | Pass the line at 40+ km/h, then stop in the box before the wall | momentum; braking distance d = v² ÷ 2a (the purple flag predicts it live) |
| 🪨 Bad Road | Rocks, steps, a hole, logs, washboard | clearance; wheel size vs step height; suspension |
| ⛰️ Hill Climb | 15°, 25°, 38° dirt ramps | gravity pull m·g·sin θ; grip must beat tan θ; wheelies |
| 🦘 Big Jump | Fly over an 18 m gap | projectile motion; front/back balance |
| ♾️ Death 8 | 3 laps of a figure 8 with crossing traffic | turning needs a = v² ÷ r; tall, narrow cars tip over, low, wide ones slide |

## Code

Plain JS with a global `BCL` namespace and classic `<script>` tags, so it works from `file://`.

- `parts.js`: catalog (bricks, engines, wheels, tyres, suspension, widths) and constants
- `car.js`: design model, validation, stats (mass, centre of mass, top speed, tip limit, …) and presets
- `tracks.js`: ground profiles, win/lose rules and "why it happened" explanations
- `topdown.js`: Death 8 simulation (path following plus lateral slide/tip limits)
- `tips.js`: per-track build checks and caveats
- `physics.js`: side-view rigid body on two spring wheels over a heightfield. Wheels roll
  onto ground lower than their centre and treat taller steps as walls. Body bricks scrape.
- `render.js`, `builder.js`, `drive.js`, `main.js`: drawing, garage UI, drive screen/HUD, routing

The current car is auto-saved to `localStorage`, along with the best stars for each track.
