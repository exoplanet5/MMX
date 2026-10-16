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

## Hipparcos field and Roman chart styling

`web/assets/hipparcos.json` contains **9,827 stars with V < 6.6** from the user's Roman chart input `data/hip_bright.csv`. Source: **ESA 1997, The Hipparcos and Tycho Catalogues, ESA SP-1200**, distributed by [CDS/VizieR, I/239/hip_main](https://cdsarc.cds.unistra.fr/viz-bin/cat/I/239). HIP identifiers, ICRS RA/Dec at catalog epoch J1991.25, and visual magnitudes are preserved. No proper-motion propagation is applied. Input SHA-256 and attribution are embedded in the JSON and both pages.

`scripts/import_hipparcos.py` validates and imports this CSV. Star-marker area and opacity follow the user's Roman sky-track figure, with white points, blue-gray constellation lines and rings for V < 1.6. Marker areas are converted to CSS-pixel diameters rather than used as WebGL point diameters. The Hipparcos field supplies the stars; the separately attributed SatObserver catalog below supplies the names and constellation overlays.

## SatObserver-MX stellar reference and d3-celestial

`web/assets/stars.json` is a data-only extraction of the user's SatObserver-MX `app/js/vendor/starcat.js`, derived from [d3-celestial](https://github.com/ofrohn/d3-celestial) and BSC5/HYG. It contains 1,018 stars to magnitude 4.6, 110 names and 150 constellation polylines. Coordinates are rounded J2000 display directions; no proper-motion correction is applied. The original catalog file's SHA-256 and source attribution are retained in the JSON metadata.

The SatObserver reference is MIT-licensed, copyright (c) 2026 Zhuoxiao, under the same MIT notice reproduced above. Its magnitude-dependent star treatment informed the new renderer; its local-horizon projection is not copied into the inertial viewer.

The upstream d3-celestial BSD notice is retained at `web/vendor/CELESTIAL_LICENSE` and embedded in both standalone HTML files:

Copyright (c) 2015, Olaf Frohn
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

## NASA Blue Marble

`web/assets/earth_day.jpg` is a 2048 × 1024 downsample of the user's shared NASA Blue Marble NG image, `world.topo.bathy.200409.3x21600x10800.jpg` (September 2004 topography/bathymetry base). The image is embedded in `docs/index.html` and credited visibly as NASA Blue Marble. It is used as a geographic illustration, not a contemporaneous cloud/weather map. [NASA Visible Earth Blue Marble collection](https://visibleearth.nasa.gov/collection/1484/blue-marble).

## Ephemerides and scientific references

Spacecraft states: JAXA planning trajectory via [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/). Lunar/solar context: shared JPL DE440s kernel, not redistributed in this repository. Full retrieval and software provenance is in `docs/data/provenance.json`; original Horizons responses and their notices are preserved under `data/raw/`.

Plot presentation was adapted from the user's Chang'e 3 and SatObserver-MX plotting conventions. Scientific models and data from those earlier studies are not imported. Illustration: Mickey.
