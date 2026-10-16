# Third-party notices

## Project license

The MMX repository retains the Apache License 2.0 in `LICENSE`. Third-party components retain their own notices and licenses below. No agency logo, official byline or representation of affiliation is used.

## Starship IFT-14 reference

UI organization and control/rendering patterns were adapted from the user's Starship IFT-14 project. The original Earth-fixed trajectory model, hazard layers, flight profiles and TLE machinery are not used. The source notice is retained at `web/vendor/STARSHIP_LICENSE` and in the standalone HTML bundle.

MIT License

Copyright (c) 2026 Zhuoxiao

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Three.js r170

Three.js and matching controls/line-rendering modules are vendored in `web/vendor/three/`. The original MIT license is retained there and embedded in the standalone HTML.

The MIT License

Copyright © 2010-2024 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

## NASA Blue Marble

`web/assets/earth_day.jpg` is a 2048 × 1024 downsample of the user's shared NASA Blue Marble NG image, `world.topo.bathy.200409.3x21600x10800.jpg` (September 2004 topography/bathymetry base). The image is embedded in `docs/index.html` and credited visibly as NASA Blue Marble. It is used as a geographic illustration, not a contemporaneous cloud/weather map. [NASA Visible Earth Blue Marble collection](https://visibleearth.nasa.gov/collection/1484/blue-marble).

## Ephemerides and scientific references

Spacecraft states: JAXA planning trajectory via [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/). Lunar/solar context: shared JPL DE440s kernel, not redistributed in this repository. Full retrieval and software provenance is in `docs/data/provenance.json`; original Horizons responses and their notices are preserved under `data/raw/`.

Plot presentation was adapted from the user's Chang'e 3 and SatObserver-MX plotting conventions. Scientific models and data from those earlier studies are not imported. Illustration: Mickey.
