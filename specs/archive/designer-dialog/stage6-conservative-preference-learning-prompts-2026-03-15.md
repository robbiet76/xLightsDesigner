## Stage 6 Conservative Preference Learning

Date: 2026-03-15
Stage: Stage 6 - Conservative Preference Learning

Purpose:
- verify that project-scoped preference learning stays useful without drifting into rigid style lock-in
- distinguish weak evidence, repeated evidence, explicit broad statements, and sequence-local exceptions

Validation themes:

1. Weak evidence stays weak
- a single accepted low-impact proposal should not create a dominant preference summary

2. Repeated evidence strengthens softly
- repeated accepted evidence in the same direction should strengthen that preference signal over time

3. Explicit broad preference statements count more
- broad statements like `In general, keep things cleaner and more focused.` should weigh more than one accepted local proposal

4. Sequence-local exception discipline
- local exceptions such as `For this sequence only, let it get denser in the final chorus.` should not rewrite the broader learned baseline

Pass criteria:
- one local accept does not dominate the profile
- repeated evidence becomes visible gradually
- explicit broad notes have stronger influence than weak inferred evidence
- sequence-local exceptions stay local and do not overwrite the baseline summary
