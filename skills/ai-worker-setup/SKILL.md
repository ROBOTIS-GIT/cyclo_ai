---
name: ai-worker-setup
description: Use when installing ROBOTIS AI Worker software, connecting by network or SSH, setting up Docker or Cyclo Manager, or configuring external-PC Zenoh communication.
---

# AI Worker Setup

Read [execution boundaries](../../references/execution.md) before commands or changes. Use the setup links and retrieval rules in [official sources](../ai-worker/references/sources.md). This skill does not provision a robot connection or credentials.

1. Establish the Follower model/revision, installed release, current setup stage and intended execution host: robot PC or user PC. Inspect existing checkout, containers and services before proposing installation. Keep the documented ROS 2 Jazzy container distinct from the host OS; check current requirements rather than replacing host drivers by default.
2. Retrieve the matching hardware/software setup sections. Prepare the documented Ethernet/Wi-Fi topology and serial-derived hostname. Confirm the physical serial, actual endpoint and SSH host key through a trusted channel before connecting; stop on an unexplained mismatch. Do not guess a sample hostname or credentials. Preserve the current access path when changing networking.
3. Inspect Docker/Compose configuration and installation scripts before authorized execution. Record device mounts, persistent data paths, GPU runtime, service effects and ports. Avoid `apt upgrade` on the robot Orin. Preserve user files and existing containers; do not execute the manual's branch-switch/update commands against a dirty checkout.
4. For Cyclo Manager, follow its robot-side installation guide. Explain that setup creates persistent services and containers; check existing installation and agent compatibility first. Prepare UI access using the verified robot endpoint. Do not start bringup as an installation test.
5. For external-PC ROS 2, use the current Zenoh guide: inspect the robot router before starting another instance, match RMW and ROS domain, and configure a client to the verified endpoint. Prefer session-local environment changes; inspect existing settings before persistent edits. Verify discovery only within the authorized network scope.
6. Report exact host/cwd, revision, commands, observed connectivity and pending steps. Hand off robot/controller readiness to [control](../ai-worker-control/SKILL.md), or Cyclo Intelligence installation to [learning](../ai-worker-learning/SKILL.md).

Examples: "Connect my F2 from an external PC"; "Prepare Cyclo Manager installation without starting the robot."
