# Display Discovery User Simulator (2026-04-09)

Status: Active
Date: 2026-04-09
Owner: xLightsDesigner Team

## Purpose

Provide a repeatable testing harness for the display-discovery conversation by simulating a user from private scenario truth while driving the real native assistant stack.

This is for regression testing and iteration speed.
It does not replace real user validation.

## Product Boundary

The simulated user must be isolated from the app agents.

That means:
- the `Designer` only sees normal app context
- the simulated user sees private scenario truth
- the simulated user does not get hidden access to the designer system prompt
- the simulated user does not inspect internal app state beyond the visible assistant transcript

## Why This Exists

Display discovery quality depends on:
- asking high-value questions
- narrowing naturally
- handling ambiguity
- not sounding scripted

Those traits need repeatable testing across:
- multiple layouts
- multiple user styles
- multiple truth sets

## Testing Model

The harness should drive:

1. the real native assistant
- through the normal automation path
- using the normal discovery prompt and app context

2. a separate simulated user
- using a private scenario file
- with controlled knowledge of the display
- with a defined conversational style

## Simulated User Rules

The simulated user should:
- answer only from scenario truth
- speak naturally
- avoid volunteering everything at once
- allow shorthand where realistic
- clarify from its own perspective when the agent is unclear

The simulated user must not:
- help the designer more than a real user would
- reveal hidden scenario structure unless asked
- optimize for making the assistant look good
- invent display facts outside the scenario

## Scenario Shape

Each scenario should define:

1. metadata
- name
- summary
- kickoff prompt
- max turns

2. user profile
- tone
- verbosity
- shorthand tendency
- willingness to volunteer extra information

3. display truth
- focal hierarchy
- themed areas
- repeating support families
- character props
- architectural/background layers
- special handling
- known ambiguities

4. success intent
- what “good enough” discovery means for that scenario

## Harness Expectations

The harness should report:
- transcript
- turn count
- assistant question count
- final unresolved branches
- final resolved branches
- final confirmed insights

## Acceptance Criteria

This harness is on the right path when:

1. it can drive the real native assistant end-to-end
2. the simulated user answers from private truth only
3. the transcript is reproducible enough for regression work
4. the harness reveals when discovery becomes too scripted, too verbose, or too narrow too early
