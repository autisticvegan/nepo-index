# The Nepo Index

Hard work pays off. Especially your dad's.

A fact-checked, ranked guide to people who got a leg up from family: 405 ranked entries, a history timeline, odds and stats, a quiz, dynasty trees, quotes, and words for nepotism from around the world.

Static site, no build step. Open `index.html` through any local server:

```
python3 -m http.server 8132
```

## Data

`js/data.js` is generated from the fact-checked research and is the only data the site uses. Every entry carries its own source links. The raw research (including internal fact-checker notes) is kept out of this repo.

After changing anything in `css/` or `js/`, bump the `?v=` on the asset links in `index.html`.
