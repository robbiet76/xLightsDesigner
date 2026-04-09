# Creative Intelligence And Framework Boundary

Date: 2026-04-08
Status: Locked
Owner: xLightsDesigner

## Purpose
This application is not a scripted sequence generator.
It is a creative system in which the LLM-backed agent team performs interpretation, questioning, synthesis, and artistic reasoning while the application provides the durable framework that makes that creativity usable, reviewable, and improvable over time.

If the product devolves into predefined rules, canned scripts, or hardcoded creative heuristics, the experiment has failed.

## Core Principle
Put intelligence in the agent layer.
Put structure, state, tools, and guardrails in the application layer.

## Application Responsibilities
The app must own:
- project state and storage
- layout metadata storage and editing surfaces
- xLights session control
- validation harness and observability
- scoped memory and persistence
- review and apply workflow boundaries
- render and validation infrastructure
- context packaging for the agent team
- safety, recovery, and user confirmation where needed

The app must not try to hardcode the creative reasoning itself.

## Agent Responsibilities
The agent team must own:
- pattern recognition over imperfect names and metadata
- semantic interpretation of models, props, and families
- layout discovery questioning
- creative design reasoning
- sequencing reasoning
- adapting to user feedback and working style
- learning from project memory and future render feedback

## Design Rule
Do not build large rule engines for creative interpretation when richer grounded context plus LLM reasoning can do the job better.

A small amount of code may prepare or package context, but code should not replace the model's ability to reason.

## Discovery Rule
During layout discovery:
- provide the model with rich raw context
- encourage it to infer likely families, repeated props, focal candidates, and structural patterns
- require it to phrase uncertain inferences as hypotheses
- require user confirmation before semantic conclusions become metadata

The system should prefer:
- "These appear to be related props. Is that right?"
over:
- "These are definitely one group."

## Memory Rule
Long-term creative quality depends on continuity.
The framework must preserve:
- bounded conversation continuity
- durable workflow preferences
- project-specific learned context
- future render-observation records

Memory should support creativity, not turn the system into a rigid rules database.

## Evolution Rule
The framework should improve as models improve.
The goal is to build durable creative infrastructure so that newer models can immediately raise the quality of design and sequencing without re-architecting the application.

## Practical Implication
When choosing between:
- adding another hardcoded heuristic
- or giving the agent richer grounded context and better instructions

prefer richer context and better agent reasoning unless a hard guardrail is required for safety or correctness.

## Immediate Implementation Consequence
Near-term work should prioritize:
1. richer layout context for discovery
2. better project memory capture from chat
3. proposal generation from discovered understanding
4. reviewable metadata application
5. later render-observation and feedback loops
