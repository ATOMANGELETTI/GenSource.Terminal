Follow the `tester-pro` skill at `.cursor/skills/tester-pro/SKILL.md`.

Run the project suites first (`npm test`, then `npm run test:e2e`), compare
coverage to `tests/surfaces.json`, and only create or fix missing/failing
tests. Do not mass-update visual baselines unless PNGs are missing or the
user explicitly requested a snapshot refresh.
