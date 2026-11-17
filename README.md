# 🧱 Brick Car Lab

A browser game for kids: build a crazy LEGO-like car, then race it on Hot Wheels-style tracks while live
physics explains **speed**, **acceleration** (speed increment per second), **forces** and **energy**.
It runs entirely in the browser: no server, no build, no dependencies. It works on iPad.

**Play:** https://djezzzl.github.io/brick-car-lab/ (or open `index.html`, double-click works).
**Tests:** open `tests.html`. It shows pass/fail and a survey of how each preset car does on each track.

## How to play

1. **Garage.** Pick a part and tap the grid to place it. Parts include:
   - plastic, foam and metal bricks, plus windows
   - wedges (triangles; ↻ Rotate turns them)
   - round bricks, a minifig driver and a spoiler
   - engines (add as many as you like)

   The bottom row is the chassis. Pick a wheel size (tiny to giant) and tap under the chassis to clip
   on a wheel. Mix sizes and add as many wheels as fit. Choose tyres, suspension height and axle width,
   and give your car a name.
2. **📊 Your car** shows the car's numbers. Tap any row to see what it means:
   - weight, power (and number of engines), power per kg
   - top speed and 0–100 km/h
   - wheels, balance and air shape (a pointy ◣ nose cuts the air)
   - clearance, centre of mass and grip
3. **💡 Tips** checks your car against the track you choose (✅/⚠️) and lists what to watch out for.
4. **Drive.** Hold GAS (→) to go and BRAKE (←) to slow down. In the air, hold BRAKE to tip the nose down.
   Booster pads give an extra push. Flips and big air get a cheer.
5. **📜 Record book.** Every finished run is saved per track in this browser, with a picture of the car,
   its time, stars, flips, weight, power, wheels and clearance. Compare your builds and tap 🔧 Load to
   bring a car back to the garage.

## Tracks and what they teach

| Track | Challenge | Physics |
|---|---|---|
| 🏎️ Speed Strip | 300 m drag race | a = F ÷ m; air drag grows with v², which sets the top speed |
| 🎢 Rollercoaster | Rolling hills with airtime | energy swap: height ⇄ speed (live energy bar) |
| 🪨 Rocky Road | Rocks, steps, a hole, logs | clearance; wheel size vs step height; suspension |
| ⛰️ Hill Climb | 15°, 25°, 38° dirt ramps | gravity pull m·g·sin θ; grip must beat tan θ |
| 🦈 Shark Jump | Booster, ramp, fly over the shark pool | projectile motion; balance in the air |
| 🌋 Volcano Run | Two lava jumps, then a climb | boosters add force; longer gaps need more speed |
| 🚀 Mega Ramp | 30 m drop, kicker, 30 m canyon | v = √(2·g·h): height turns into speed |

## Code

Plain JS with a global `BCL` namespace and classic `<script>` tags, so it works from `file://`.

- `parts.js`: catalog (bricks, shapes, engines, wheels, tyres, suspension, widths) and constants
- `car.js`: design model, wheel placement, validation, stats and presets, plus upgrading old saved cars
- `tracks.js`: ground profiles, boosters, hazards, win/lose rules, flips and explanations
- `tips.js`: per-track build checks and caveats
- `physics.js`: side-view rigid body on any number of sprung wheels over a heightfield.
  It also handles booster pads and air control (braking in the air tips the nose down).
- `records.js`: record book in `localStorage`
- `render.js`, `builder.js`, `drive.js`, `main.js`: drawing, garage UI, drive screen and HUD, routing

The current car is auto-saved to `localStorage`.
