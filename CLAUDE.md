# Tabby project rules

Single source of truth for project rules lives in `.cursor/rules/*.mdc` (also used by Cursor). Imported here so Claude follows the same rules.

@.cursor/rules/tabby-workflow.mdc
@.cursor/rules/tabby-code-style.mdc
@.cursor/rules/tabby-prose.mdc
@.cursor/rules/tabby-testing.mdc
@.cursor/rules/tabby-peek-mood.mdc
@.cursor/rules/tabby-privacy-permissions.mdc
@.cursor/rules/tabby-site-registry.mdc
@.cursor/rules/tabby-gif-pipeline.mdc
@.cursor/rules/tabby-website.mdc

When adding a new rule, create it under `.cursor/rules/` and add an `@` import line above.
