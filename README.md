# Racing City 🏙️🏁

A top-down driving game made from Mehek's drawings and ideas. Drive and walk around a city, do missions, race your friends online, and collect the **Top 100** cars, bikes and boats.

## How to play

Open `index.html` in any web browser. There's nothing to install.

Online multiplayer works on the shared Racing City link on claude.ai: everyone who has that link open at the same time plays in the same city. Copies of the game hosted anywhere else (for example GitHub Pages) play solo.

To host it yourself, turn on **GitHub Pages** for this repository (Settings → Pages → deploy from the `main` branch).

## What's in the game

- **A city** with 3D-looking buildings, sun shadows, a day and night cycle with street lamps and headlights, traffic, people walking around, two parks, a beach and the sea.
- **Get out of your car** and walk around, then get back in.
- **Tutorial**: a step-by-step guide the first time you play (you can replay it from Settings).
- **Missions** from people with a yellow **!**:
  - Delivery Dan: deliver parcels across town
  - Taxi Tara: pick up passengers and drive them where they want to go (stop to let them in and out)
  - Coach Kai: drive through 6 checkpoints before time runs out
  - Captain Nia: a boat run through buoys at sea
  - Star Sam: find the 25 gold stars hidden around the city
- **Multiplayer**: see your friends drive and walk around the city, send emojis, and race each other in online race lobbies.
- **Mehek Motors (the Car Shop)**, laid out like the drawing: **Buy cars**, the **Trading area**, **Sell cars**, and the **Lambo**, **BMW** and **Mercedes** on display.
- **Upgrade Shop**: Engine, Turbo, Tires and Nitro (5 levels each), plus paint colours.
- **Racing Area**: Easy, Medium, Hard, Extreme and Impossible tracks plus a Boat Race. Finish in the top places to earn money.
- **Marina**: switch between your boats and your land vehicles.
- **Camera zoom**: mouse wheel, `+` / `−`, pinch, or the 🔍 buttons.
- **Phones**: play with the phone turned sideways. There's a joystick, and you can turn on tilt-to-steer in ⚙️ Settings where the phone allows it.
- **Settings**: graphics quality (High or Fast for older phones), steering, your character's look, and your online name.
- The game saves automatically in your browser.

## Controls

| | Keyboard | Controller (Xbox / PlayStation) | Phone / tablet |
|---|---|---|---|
| Steer / walk | WASD or arrows | Left stick or D-pad | Joystick |
| Gas | W or ↑ | RT / R2 | GAS (or push the joystick up) |
| Brake / reverse | S or ↓ | LT / L2 | BRAKE |
| Nitro / run | Shift | B / Circle or RB | NITRO |
| Drift | Space | X / Square | DRIFT |
| Get out / get in | F | LB / L1 or Back | 🚶 OUT / 🚗 IN |
| Talk / use / enter | E or Enter | A / Cross | ACTION |
| Zoom | + / − or mouse wheel | Right stick up / down | Pinch or 🔍 |
| Garage | G | Y / Triangle | 🏠 |
| Pause / close | Esc | Start | ✕ |

## Files

- `index.html`, `style.css`: the page and its look
- `js/vehicles.js`: the Top 100 vehicles
- `js/city.js`: the city map, 3D buildings and how it's drawn
- `js/fx.js`: particles, day and night, lights and cloud shadows
- `js/people.js`: people walking around, and you on foot
- `js/missions.js`: missions, gold stars and the tutorial
- `js/multiplayer.js`: online play
- `js/dealer.js`: inside the Car Shop
- `js/tracks.js`: the race tracks
- `js/input.js`: keyboard, touch, game controller, zoom and tilt
- `js/game.js`: driving, racing, shops, menus, saving and sound
