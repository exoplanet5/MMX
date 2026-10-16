"""Render the four ECI study figures from the canonical JSON, without network access."""
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import colors, font_manager, patheffects
from matplotlib.collections import LineCollection
from matplotlib.patches import Circle
from mpl_toolkits.mplot3d.art3d import Line3DCollection
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
D = json.loads((ROOT / "docs/data/ephemeris.json").read_text())
M = D["meta"]
T = np.asarray(D["elapsed_s"]) / 86400
R = np.asarray(D["states"]["mmx"])[:, :3] / 1000
MOON = np.asarray(D["states"]["moon"])[:, :3] / 1000
BG, SURFACE, FG, DIM = "#101418", "#05070a", "#e8eaed", "#9aa4ae"
BLUE, ORANGE = "#3987e5", "#d95926"
CMAP = colors.LinearSegmentedColormap.from_list("departure", ["#3987e5", "#6da7ec", "#a1d4fc"])
HALO = [patheffects.withStroke(linewidth=3, foreground=SURFACE)]
font = Path("/System/Library/Fonts/Menlo.ttc")
if font.exists():
    font_manager.fontManager.addfont(str(font))
plt.rcParams.update({"font.family": "Menlo" if font.exists() else "DejaVu Sans Mono", "font.size": 10,
                     "figure.facecolor": BG, "axes.facecolor": SURFACE, "axes.edgecolor": "#2a323c",
                     "text.color": FG, "axes.labelcolor": DIM, "xtick.color": DIM, "ytick.color": DIM,
                     "grid.color": "#242b32", "grid.linewidth": .5, "axes.grid": True,
                     "legend.facecolor": BG, "legend.edgecolor": "#2a323c", "legend.labelcolor": FG,
                     "savefig.facecolor": BG})
OUT = ROOT / "docs/plots"
OUT.mkdir(parents=True, exist_ok=True)


def header(fig, title, subtitle, right="ECI · 6 days"):
    fig.text(.045, .965, title, fontsize=16, weight="bold", va="top")
    fig.text(.045, .925, subtitle, fontsize=9.4, color=DIM, va="top")
    fig.text(.96, .965, right, fontsize=11, color=DIM, va="top", ha="right")


def footer(fig, note=""):
    fig.text(.045, .048, note, fontsize=8.5, color=DIM)
    fig.text(.045, .021, "Planning trajectory · JAXA / JPL Horizons −239 · geometric Earth-centered ICRF · UTC", fontsize=8.5, color=DIM)
    fig.text(.96, .021, "Illustration: Mickey", ha="right", fontsize=9, path_effects=HALO)


def save(fig, name):
    path = OUT / name
    fig.savefig(path, dpi=180)
    plt.close(fig)
    with Image.open(path) as image:
        assert image.size == (2880, 1782), image.size
    print(path)


def trajectory(ax, pos, days, plane=(0, 1), end=6):
    xy = pos[:, plane]
    segments = np.stack([xy[:-1], xy[1:]], axis=1)
    lc = LineCollection(segments, cmap=CMAP, norm=colors.Normalize(0, end), linewidth=2)
    lc.set_array(days[:-1]); ax.add_collection(lc)
    return lc


def label(ax, point, text, offset=(10, 10), **kwargs):
    ax.annotate(text, point, xytext=offset, textcoords="offset points", fontsize=8.7,
                color=FG, path_effects=HALO, zorder=10, **kwargs)


def earth(ax):
    ax.add_patch(Circle((0, 0), M["earth_radius_km"] / 1000, facecolor="#21466a", edgecolor=DIM, lw=.7, zorder=4))


def overview():
    fig, axs = plt.subplots(1, 2, figsize=(16, 9.9))
    fig.subplots_adjust(left=.065, right=.965, bottom=.18, top=.855, wspace=.19)
    header(fig, "MMX · departure from Earth", "19 Oct 2026 21:00 → 25 Oct 2026 21:00 UTC  |  JAXA pre-launch planning solution")
    for ax, plane in zip(axs, [(0, 1), (0, 2)]):
        lc = trajectory(ax, R, T, plane)
        ax.plot(MOON[:, plane[0]], MOON[:, plane[1]], color=DIM, lw=1, ls="--", label="Moon path · DE440s")
        ax.plot(MOON[0, plane[0]], MOON[0, plane[1]], "o", ms=5, mfc=BG, mec=DIM)
        label(ax, MOON[0, list(plane)], "Moon · 19 Oct", (-8, -16), ha="right")
        earth(ax); label(ax, (0, 0), "Earth", (10, 9))
        for day in range(1, 7):
            p = R[day * 1440, list(plane)]
            ax.plot(*p, "o", color=CMAP(day / 6), ms=6, mec=SURFACE, mew=1.2)
            label(ax, p, f"{19 + day} Oct", (10, -14))
        ax.plot(*R[0, list(plane)], "^", ms=6, color=BLUE, mec=SURFACE)
        label(ax, R[0, list(plane)], "19 Oct · start", (15, -27))
        ax.set_xlim(-1400, 430)
        ax.set_ylim((-360, 1470) if plane[1] == 1 else (-600, 1230))
        ax.set_aspect("equal")
        ax.set_xlabel("X  [10³ km]"); ax.set_ylabel(f"{'Y' if plane[1] == 1 else 'Z'}  [10³ km]")
        ax.set_title("Equatorial plane · X–Y" if plane[1] == 1 else "Meridian plane · X–Z", fontsize=11, color=DIM, pad=14)
        ax.legend(loc="upper right", fontsize=8.5)
    cbax = fig.add_axes([.22, .107, .56, .017])
    cb = fig.colorbar(lc, cax=cbax, orientation="horizontal", ticks=range(7))
    cb.ax.set_xticklabels([f"{19 + d} Oct" for d in range(7)])
    cb.set_label("UTC epoch · each tick is 21:00", fontsize=9)
    footer(fig, "MMX: solid, color = date. Moon: dashed. Epoch markers are enlarged; spatial axes and Earth radius are to scale.")
    save(fig, "01_eci_overview.png")


def view3d():
    fig = plt.figure(figsize=(16, 9.9))
    ax = fig.add_axes([.04, .10, .74, .78], projection="3d")
    header(fig, "MMX · six days in inertial space", "Earth at the origin  |  Equatorial ICRF axes  |  Same geometric states as the interactive viewer")
    segments = np.stack([R[:-1], R[1:]], axis=1)
    lc = Line3DCollection(segments, cmap=CMAP, norm=colors.Normalize(0, 6), linewidth=2)
    lc.set_array(T[:-1]); ax.add_collection3d(lc)
    ax.plot(*MOON.T, color=DIM, ls="--", lw=1, label="Moon path")
    ax.scatter(0, 0, 0, s=45, color="#3987e5", edgecolor=FG, label="Earth geocenter")
    ax.text(30, 0, 20, "Earth / start", fontsize=9, color=FG)
    ax.text(*MOON[0], "  Moon", color=FG, fontsize=9)
    for day in (2, 4, 6):
        p = R[day * 1440]
        ax.scatter(*p, s=28, color=CMAP(day / 6))
        ax.text(*(p + [0, 25, 50]), f"{19 + day} Oct", fontsize=9)
    ax.set_xlim(-1400, 400); ax.set_ylim(-400, 1400); ax.set_zlim(-700, 1100)
    ax.set_box_aspect((1, 1, 1)); ax.view_init(elev=23, azim=51)
    ax.set_xticks([-1200, -800, -400, 0]); ax.set_yticks([-400, 0, 400, 800, 1200]); ax.set_zticks([-400, 0, 400, 800])
    for axis in (ax.xaxis, ax.yaxis, ax.zaxis):
        axis.set_pane_color((.02, .03, .04, .2))
        axis._axinfo["grid"].update(color=(.16, .19, .22, .6), linewidth=.5)
    ax.set_xlabel("X [10³ km]", labelpad=10); ax.set_ylabel("Y [10³ km]", labelpad=10); ax.set_zlabel("Z [10³ km]", labelpad=10)
    ax.legend(loc="upper left", fontsize=9)
    summary = D["summary"]
    fig.text(.77, .74, "EARTH DEPARTURE", fontsize=11, color=DIM)
    fig.text(.77, .67, "8,704 km", fontsize=23)
    fig.text(.77, .63, "initial geocentric range", fontsize=9, color=DIM)
    fig.text(.77, .53, "1.776 million km", fontsize=17)
    fig.text(.77, .49, "final geocentric range", fontsize=9, color=DIM)
    fig.text(.77, .37, f"{summary['start']['speed_km_s']:.3f} → {summary['end']['speed_km_s']:.3f} km/s", fontsize=14)
    fig.text(.77, .33, "geocentric speed", fontsize=9, color=DIM)
    fig.text(.77, .21, "Pre-launch planning data\nNot flight reconstruction\n\nAll three axes use equal scale.", fontsize=9, color=DIM, linespacing=1.6)
    footer(fig, "MMX: solid blue time ramp. Moon: dashed grey. Point markers are enlarged for visibility.")
    save(fig, "02_eci_3d.png")


def departure():
    fig, axs = plt.subplots(1, 2, figsize=(16, 9.9))
    fig.subplots_adjust(left=.075, right=.965, bottom=.18, top=.855, wspace=.19)
    hours = 3
    count = hours * 60 + 1
    r = R[:count]
    header(fig, "MMX · near-Earth departure", "19 Oct 2026 21:00 → 20 Oct 2026 00:00 UTC  |  First three hours of the requested window", "ECI · detail")
    for ax, plane in zip(axs, [(0, 1), (0, 2)]):
        lc = trajectory(ax, r, T[:count], plane, end=hours / 24)
        earth(ax)
        label(ax, (0, 0), "Earth", (0, -44), ha="center")
        for minute in (0, 30, 60, 120, 180):
            p = r[minute, list(plane)]
            ax.plot(*p, "^" if minute == 0 else "o", ms=6, color=CMAP(minute / 180), mec=SURFACE)
            hour, mm = divmod(21 * 60 + minute, 60)
            txt = f"{hour % 24:02d}:{mm:02d}" + (" · start" if minute == 0 else "")
            label(ax, p, txt, (10, -12) if minute else (8, -20))
        ax.set_xlim(-62, 30); ax.set_ylim(-15, 77)
        ax.set_aspect("equal")
        ax.set_xlabel("X [10³ km]"); ax.set_ylabel(f"{'Y' if plane[1] == 1 else 'Z'} [10³ km]")
        ax.set_title("X–Y projection" if plane[1] == 1 else "X–Z projection", color=DIM, fontsize=11, pad=14)
    cbax = fig.add_axes([.22, .107, .56, .017])
    cb = fig.colorbar(lc, cax=cbax, orientation="horizontal", ticks=np.arange(4) / 24)
    cb.ax.set_xticklabels(["19 Oct 21:00", "22:00", "23:00", "20 Oct 00:00"])
    cb.set_label("UTC epoch", fontsize=9)
    footer(fig, "Earth disk: 6,378.137 km radius, to scale. The window begins after launch; no ascent or earlier orbit is reconstructed.")
    save(fig, "03_departure_zoom.png")


def timeseries():
    fig, axs = plt.subplots(3, 1, figsize=(16, 9.9), sharex=True)
    fig.subplots_adjust(left=.10, right=.95, bottom=.13, top=.865, hspace=.24)
    header(fig, "MMX · departure diagnostics", "19–25 October 2026  |  Center-to-center distances and inertial speed  |  Separate vertical scales")
    specs = [("earth_range_km", 1e6, "Earth range\n[10⁶ km]", BLUE),
             ("moon_distance_km", 1e6, "Moon separation\n[10⁶ km]", ORANGE),
             ("speed_km_s", 1, "Geocentric speed\n[km/s]", BLUE)]
    for ax, (key, scale, ylabel, color) in zip(axs, specs):
        values = np.asarray(D["metrics"][key]) / scale
        ax.plot(T, values, lw=2, color=color)
        ax.fill_between(T, values, values.min(), color=color, alpha=.07)
        ax.set_ylabel(ylabel, fontsize=10)
        ax.set_xlim(-.08, 6.35)
        for index, offset in [(0, (12, -15)), (-1, (10, 4))]:
            ax.plot(T[index], values[index], "o", ms=6, color=color, mec=SURFACE)
            label(ax, (T[index], values[index]), f"{values[index]:.3f}", offset)
    axs[-1].set_xticks(range(7), [f"{19 + day} Oct\n21:00" for day in range(7)])
    axs[-1].set_xlabel("UTC epoch", labelpad=8)
    footer(fig, "Both distances increase throughout the sampled window. Minimum Moon separation occurs at its start boundary, not at a flyby.")
    save(fig, "04_range_speed.png")


if __name__ == "__main__":
    overview(); view3d(); departure(); timeseries()
