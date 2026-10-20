# Mehek City Racer 🏙️🏁

A top-down driving game made from Mehek's drawing and ideas. Drive around a city, win races to earn money, and collect the **Top 100** cars, bikes and boats.

## How to play

Open `index.html` in any web browser. There's nothing to install.

To play online, turn on **GitHub Pages** for this repository (Settings → Pages → deploy from the `main` branch). The game will then be at `https://rtralrayhan.github.io/Game-Mehek/`.

## What's in the game

- **A city** with roads, traffic, sidewalks, two parks (a fountain, ponds, a playground and cherry trees), a beach and the sea.
- **Mehek Motors (the Car Shop)**, laid out like the drawing:
  - **Buy cars** desk (top left): the full Top 100 list of cars, bikes and boats
  - **Trading area** (top middle): trade in your vehicle for a better price than selling it
  - **Sell cars** desk (top right)
  - The **Lambo**, **BMW** and **Mercedes** on display
  - **Enter** and **Exit** doors
- **Upgrade Shop**: Engine, Turbo, Tires and Nitro (5 levels each), plus paint colours.
- **Racing Area** with tracks for every level:
  - Easy: Sunny Park Loop
  - Medium: City Circuit
  - Hard: Mountain Twist
  - Extreme: Dragon Snake
  - Impossible: Nightmare Ring
  - Boat Race: Harbor Splash
  Finish a race in the top places to earn money. Harder tracks pay more.
- **Marina**: switch between your boats and your land vehicles.
- The game saves automatically in your browser.

## Controls

| | Keyboard | Controller (Xbox / PlayStation) | Phone / tablet |
|---|---|---|---|
| Steer | A / D or ← → | Left stick or D-pad | ◀ ▶ |
| Gas | W or ↑ | RT / R2 | GAS |
| Brake / reverse | S or ↓ | LT / L2 | BRAKE |
| Nitro | Shift | B / Circle or RB | NITRO |
| Handbrake / drift | Space | X / Square | DRIFT |
| Use / enter | E or Enter | A / Cross | ACTION |
| Garage | G | Y / Triangle | 🏠 |
| Pause / close | Esc | Start | ✕ |

Tap 🕹️ at the top of the screen to show or hide the on-screen controller.

## Files

- `index.html`, `style.css`: the page and its look
- `js/vehicles.js`: the Top 100 vehicles
- `js/city.js`: the city map and how it's drawn
- `js/dealer.js`: inside the Car Shop
- `js/tracks.js`: the race tracks
- `js/input.js`: keyboard, touch and game controller
- `js/game.js`: driving, racing, shops, saving and sound
