# Repository Guidelines

## Project Structure & Module Organization
Core app code lives in `src/`. Route entry points are in `src/pages` (for example `index.astro`, `archive.astro`, and `posts/[...slug].astro`). Shared UI is split by domain under `src/components` (`archive/`, `home/`, `post/`, `common/`). Layout shells are in `src/layouts`, reusable helpers in `src/lib`, state stores in `src/stores`, and global styling in `src/styles/global.css`.

Content is managed in `src/content/blog` (Markdown/MDX) with schema rules in `src/content.config.ts`. Site-level settings are in `src/config/site.config.yaml`. Static assets belong in `public/`. Build output is generated in `dist/` and should not be edited manually. CI utility scripts (for example deployment notifications) live in `scripts/`.

## Build, Test, and Development Commands
- `pnpm install --frozen-lockfile`: install exact dependency versions.
- `pnpm dev`: start the Astro dev server.
- `pnpm build`: produce a production build in `dist/`.
- `pnpm preview`: serve the built site locally.
- `pnpm astro check`: run Astro/TypeScript/content validation checks.
- For development server runs (for example `pnpm run dev` or `pnpm dev`), ensure startup logs print a reachable dev URL for manual testing.

## Environment Verification
- For system-level availability checks (for example `node -v`, `npm -v`, `pnpm -v`), use sandbox command output directly as the default verification source.

## Coding Style & Naming Conventions
Use TypeScript, Astro, and React functional components. Match the existing formatting style within each file and avoid mixed formatting in edited blocks. Follow naming patterns already used:
- Components: `PascalCase` (example: `ArchiveApp.tsx`).
- Utilities/stores/config modules: `camelCase` filenames (example: `utils.ts`, `player.ts`).
- Route files: Astro routing conventions (`[...slug].astro`).

Keep design tokens and global rules in `src/styles/global.css`; keep component-specific behavior in component files.

### Theme System
Themes live in `src/themes/<id>/` and target the interface contract in `src/themes/_contract.md` (currently `api: 1`), never component source. When editing components:
- Colors must go through semantic utilities backed by `--c-*` variables (`bg-ink`, `text-on-ink`, `border-line-strong`, `text-accent` ...). Do not add `dark:` color variants or hard-coded palette colors; light/dark differences belong in variables.
- Keep `data-ui` anchors and `data-state` / `aria-*` state attributes intact. Renaming or removing a `data-ui` value is a breaking contract change: bump `CONTRACT_VERSION` (`src/lib/themes/schema.ts`), the version in `_contract.md`, and every `theme.json` `api`. New anchors must be documented in `_contract.md`.
- Component `<style>` blocks go inside `@layer components { ... }` (unlayered CSS would override theme `@layer skin`).
- `pnpm build` / `pnpm astro check` run the theme contract check (`integrations/themeContract.ts`) and warn about unknown anchors; `pnpm dev` serves the theme playground at `/dev/themes`.

## Testing Guidelines
There is no dedicated unit test framework configured yet. Use `pnpm astro check` as the required automated validation step, then run `pnpm run dev` for manual verification. For UI or content logic changes, ask the user to test `index`, `/archive`, and post detail routes in both desktop and mobile views, then wait for user feedback before continuing.

## Commit & Pull Request Guidelines
Recent commits follow Conventional Commit style (`feat:`, `fix:`, `style:`, `chore:`), sometimes with scope (`fix(archive): ...`). Keep commits focused and descriptive.

PRs should include:
- A short summary of behavior changes.
- Verification steps/commands run locally.
- Linked issue/task when applicable.
- Screenshots or clips for visual/UI updates.

Deploy workflow targets the `dev` branch, so keep PR base/merge strategy aligned with that flow.
