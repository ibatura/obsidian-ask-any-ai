import tseslint from 'typescript-eslint';
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";
import { DEFAULT_BRANDS } from "eslint-plugin-obsidianmd/dist/lib/rules/ui/brands.js";
import { DEFAULT_ACRONYMS } from "eslint-plugin-obsidianmd/dist/lib/rules/ui/acronyms.js";

// Product/company names used throughout this plugin's UI that aren't in the
// rule's default brand list, plus the multi-word "Anthropic Messages API"
// phrase so it's preserved as a unit rather than split token-by-token.
const EXTRA_BRANDS = [
	"Claude",
	"Copilot",
	"Gemini",
	"Anthropic",
	"Anthropic Messages API",
	"OpenAI",
	"Together",
];

// "LLM" is a common acronym in this plugin's domain but isn't in the rule's
// default acronym list.
const EXTRA_ACRONYMS = ["LLM"];

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
				// Desktop-only plugin (isDesktopOnly: true) — Electron renderer
				// also exposes Node globals such as Buffer via child_process usage.
				...globals.node,
			},
			parserOptions: {
				projectService: {
					// Test files, mocks, and config scripts live outside tsconfig.json's
					// `include` (kept narrow so `tsc --noEmit` / esbuild only ever see
					// production source). They're type-checked via tsconfig.eslint.json
					// instead, which covers the whole repo.
					defaultProject: './tsconfig.eslint.json',
					allowDefaultProject: [
						'eslint.config.js',
						'manifest.json',
						'vitest.config.ts',
						'__mocks__/*.ts',
						'src/*.test.ts',
						'src/commands/*.test.ts',
						'src/core/*.test.ts',
						'src/ui/*.test.ts',
					],
					maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 20,
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json']
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		// Test files and mocks legitimately pass loosely-typed mock objects
		// (e.g. `{} as any` standing in for `App`/`Editor`/`TFile`) to functions
		// that expect real Obsidian types. That's normal test-double practice,
		// not a production type-safety concern, so the type-aware rules that
		// flag it are relaxed here.
		files: ["**/*.test.ts", "__mocks__/**/*.ts"],
		rules: {
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-unsafe-argument": "off",
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-return": "off",
			"@typescript-eslint/no-misused-promises": "off",
		},
	},
	{
		plugins: { obsidianmd },
		rules: {
			"obsidianmd/ui/sentence-case": [
				"error",
				{
					brands: [...DEFAULT_BRANDS, ...EXTRA_BRANDS],
					acronyms: [...DEFAULT_ACRONYMS, ...EXTRA_ACRONYMS],
					// Literal example values shown verbatim in the UI (a CLI binary
					// name and the plugin's own default heading text) rather than
					// descriptive prose, so sentence-case doesn't apply to them.
					ignoreRegex: ["^claude$", "^AI Result$"],
				},
			],
		},
	},
	globalIgnores([
		"node_modules",
		"dist",
		"esbuild.config.mjs",
		"eslint.config.js",
		"version-bump.mjs",
		"versions.json",
		"main.js",
	]),
);
