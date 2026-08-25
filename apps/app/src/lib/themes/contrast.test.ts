import { describe, expect, it } from "vitest";
import { catppuccinThemeCss } from "./catppuccin";
import { draculaThemeCss } from "./dracula";
import { gruvboxThemeCss } from "./gruvbox";
import { nordThemeCss } from "./nord";
import { solarizedThemeCss } from "./solarized";

const themes = {
  catppuccin: catppuccinThemeCss,
  dracula: draculaThemeCss,
  gruvbox: gruvboxThemeCss,
  nord: nordThemeCss,
  solarized: solarizedThemeCss,
} as const;

const EXPECTED_TEXT_RAMP = {
  "muted-foreground": 88,
  "readback-foreground": 78,
  "subtle-foreground": 68,
} as const;

function selectorBlock(css: string, selector: ":root, .light" | ".dark") {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`missing ${selector}`);
  const bodyStart = start + selector.length + 2;
  return css.slice(bodyStart, css.indexOf("}", bodyStart));
}

function declarations(block: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const match of block.matchAll(/--([a-z-]+):\s*([^;]+);/g)) {
    values.set(match[1], match[2].trim());
  }
  return values;
}

function hexLuminance(hex: string): number {
  const channels = [1, 3, 5].map(
    (at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255,
  );
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = hexLuminance(first);
  const secondLuminance = hexLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("built-in theme conversation contrast", () => {
  for (const [name, css] of Object.entries(themes)) {
    const light = declarations(selectorBlock(css, ":root, .light"));
    const darkOverrides = declarations(selectorBlock(css, ".dark"));

    for (const [mode, values] of [
      ["light", light],
      ["dark", new Map([...light, ...darkOverrides])],
    ] as const) {
      it(`${name} ${mode} keeps primary prose high contrast`, () => {
        const canvas = values.get("canvas");
        const ink = values.get("ink");
        expect(canvas).toMatch(/^#[0-9a-f]{6}$/i);
        expect(ink).toMatch(/^#[0-9a-f]{6}$/i);
        expect(contrastRatio(ink!, canvas!)).toBeGreaterThanOrEqual(9);
      });

      it(`${name} ${mode} uses the shared semantic text ramp`, () => {
        for (const [token, percentage] of Object.entries(EXPECTED_TEXT_RAMP)) {
          expect(values.get(token)?.replace(/\s+/g, " ")).toBe(
            `color-mix(in oklch, var(--ink) ${percentage}%, var(--canvas))`,
          );
        }
      });
    }
  }
});
