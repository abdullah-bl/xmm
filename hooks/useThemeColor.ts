import { useCSSVariable } from "uniwind";

type ThemeColor =
	| "background"
	| "foreground"
	| "surface"
	| "surface-foreground"
	| "overlay"
	| "overlay-foreground"
	| "muted"
	| "accent"
	| "accent-foreground"
	| "default"
	| "default-foreground"
	| "success"
	| "success-foreground"
	| "warning"
	| "warning-foreground"
	| "danger"
	| "danger-foreground"
	| "border"
	| "separator"
	| "focus"
	| "link";

/** Resolve theme colors from CSS variables via uniwind. */
export function useThemeColor(themeColor: ThemeColor): string;
export function useThemeColor(themeColor: ThemeColor[]): string[];
export function useThemeColor(
	themeColor: ThemeColor | ThemeColor[],
): string | string[] {
	const isArray = Array.isArray(themeColor);
	const cssVariables = isArray
		? themeColor.map((color) => `--color-${color}`)
		: [`--color-${themeColor}`];

	const resolvedColors = useCSSVariable(cssVariables);

	const processedColors = (resolvedColors as (string | number)[]).map(
		(color) => {
			if (typeof color === "string") return color;
			if (typeof color === "number") return String(color);
			return "transparent";
		},
	);

	return isArray ? processedColors : processedColors[0];
}
