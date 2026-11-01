# Destiny Rising Builds

Fan tools for **Destiny Rising**, built from the game's own data. Live site: https://kiexster.github.io/destiny-rising-builds/

## Emanare Planner

- Plan the Emanare board of seasons 4, 5 and 6.
- See the attributes and Character Power it gives, and the total Glimmer and material cost.
- Share a build as a link.
- English and Spanish, using the game's official names.

The rules are the game's:
- A node unlocks once its preceding node is unlocked and the Core Node level is high enough.
- Attribute Nodes go up one level at a time. Each level has its own cost and Core Node requirement.

Character Node auras and gem rolls depend on each account and are not included.

## Character Builds

The loadouts the game itself recommends, for 22 characters:
- 3 artifact builds each, with their Offense, Survival and Control ratings.
- The piece for every slot, with its effect and values.
- The attributes to look for.
- Weapons per slot by rarity.
- The teammates with the most affinity.

## How it works

`docs/` is a static site, with no server or build step, published with GitHub Pages. `tools/build_emanare.py` and `tools/build_builds.py` generate `docs/data/` and `docs/img/` from data tables and art extracted from the game client. See `LEEME.md` (Spanish) for how to regenerate it after a patch.

## Disclaimer

Non-profit fan project. It is not made, endorsed or supported by NetEase, Bungie or the Destiny Rising team. Destiny Rising, Destiny and the in-game names belong to their respective owners.
