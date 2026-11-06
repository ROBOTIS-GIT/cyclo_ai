---
name: omx-setup
description: Use when assembling OMX, identifying Leader and Follower USB ports, installing native LeRobot or OpenMANIPULATOR ROS 2, or configuring OMX Docker, Cyclo Manager or Zenoh.
---

# OMX Setup

Read [execution boundaries](../../references/execution.md) and the selected setup pages in [official sources](../omx/references/sources.md).

1. Identify OMX-L/F roles, software revision, host OS and chosen stack. Preserve native LeRobot or ROS 2/Cyclo Intelligence already selected. If the next installation depends on an unknown stack, resolve that choice first. Inspect existing environments, checkouts and containers before changes; do not import OMY's onboard-PC/SSH topology.
2. Use the arm-specific assembly guide for mounting, reference marks and power/cables. Disconnect power before cable assembly. Camera equipment is optional; establish the actual camera and connection rather than assuming OMY's RealSense/hub arrangement. Preserve factory IDs and offsets; do not run another robot's motor setup or calibration as onboarding. Modified/repaired hardware needs its own verified recovery procedure.
3. For authorized port identification, physically distinguish Leader and Follower and record their actual USB serial identities. Do not infer roles from tty numbering. Follow the selected guide's one-device-at-a-time identification only when disconnecting is safe and no process commands the arm. Match stable by-id paths or verified udev aliases. Persistent rules require actual vendor/serial attributes and scoped host changes, not copied sample values.
4. For ROS 2, inspect OpenMANIPULATOR Docker helpers, USB mounts, volumes and launch port arguments. Prefer supported per-run overrides; if the checkout requires file edits, preserve originals and record the change. Cyclo Manager runs on the user PC hosting OMX containers and creates persistent services. Configure Zenoh/RMW/domain for the actual ROS topology only; inspect existing routers first.
5. For native LeRobot, use an isolated matching Python checkout/environment and the documented DYNAMIXEL support. Do not install ROS, Cyclo Manager or Zenoh as a native-only prerequisite. Keep native and ROS processes from owning the same device simultaneously.

Report host, stack/revision, verified role-to-port mapping and observed setup results. Installation or USB identification does not authorize homing, torque or teleoperation. Hand off readiness to [control](../omx-control/SKILL.md) or [teleoperation](../omx-teleop/SKILL.md).
