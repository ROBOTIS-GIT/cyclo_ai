---
name: ai-sapiens-control
description: Explain AI Sapiens K1 impedance and ROS 2 interfaces, prepare external-PC Zenoh communication or bounded read-only Python joint-state collection.
---

# Ai Sapiens Control

Read [execution boundaries](../../references/execution.md) before commands or changes, and [official retrieval](../../references/sources.md) before factual guidance. Fetch only the relevant source and reference; do not load the whole manual. Preserve the user's instructions and authorization. This workflow has no GPU/robot executor or credential store; the device MCP does not execute that workflow.

1. Identify the goal: explain impedance/topic schemas, prepare external-PC ROS 2, read state with Python, or request actuation. Identify robot revision, actual endpoint and environment. Read only [impedance](references/impedance.md), [ROS 2](references/ros2.md), or [SDK](references/sdk.md) as needed, then the live official page.
2. Keep ROS 2 container setup separate from the Python SDK, which can subscribe without installing ROS 2. Inspect installed CLI/package versions before generating version-specific code. Do not persist the example network endpoint or ROS settings globally.
3. Prefer bounded state reads for diagnostics. For supplied offline messages check timestamps and equal-index arrays without connecting to a robot. No observed samples means no successful communication claim.
4. Publishing even zero gains changes hardware control. A documentation question does not authorize command publication, gain tuning, service startup or controller/mode changes. For later authorized control, require onsite safeguards and the Sim2Real workflow; never describe arbitrary gains or zero damping as safe.
5. Return a sourced explanation or scoped setup/code plan, prerequisites, exact checks and execution status. If sources/API help are unavailable, leave the uncertain fields unresolved rather than inventing signatures or topic semantics.

Examples: “What do kp and kd mean?”; “I want to read joint_states without installing ROS”; “Prepare an external-PC Zenoh connection.”
