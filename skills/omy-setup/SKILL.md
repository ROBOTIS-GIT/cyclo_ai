---
name: omy-setup
description: Use when installing OMY software, identifying hardware and camera connections, preparing SSH or Docker access, setting up Cyclo Manager, or connecting an external PC through Zenoh.
---

# OMY Setup

Read [execution boundaries](../../references/execution.md) and the installation links in [official sources](../omy/references/sources.md) before commands or changes.

1. Establish model/revision, installed OMY OS/software and current setup stage. Separate robot PC from user PC and identify the host for each proposed command. Inspect existing checkout, containers and persistent volumes; do not replace a working installation to match a manual example.
2. Use the exact model's wiring illustrations. Confirm arm mounting, power and camera routing. The documented camera connection uses the user PC and included USB 3.0 hub; verify the actual host before configuring a camera node. Do not probe devices merely to explain wiring.
3. For network/SSH, match the actual serial-labelled robot, reachable endpoint and trusted host-key fingerprint. Retrieve the setup/OS-specific access method; mixed username examples do not justify guessing credentials or disabling verification. Preserve a recovery path before network changes.
4. Inspect the documented OpenMANIPULATOR checkout, container helper and workspace mounts before authorized installation/update. Review device access, networking, ports and data persistence. Preserve dirty files and container data rather than blindly switching branches, pulling or recreating containers. Cyclo Manager belongs on the robot PC and creates persistent services; inspect existing setup first. Hand off user-PC Cyclo Intelligence to [learning](../omy-learning/SKILL.md).
5. Configure external-PC Zenoh from the current OMY guide, using the verified router and consistent RMW/domain. Check existing services before starting another router and prefer session-local settings before persistent changes.
6. Establish physical packing state before any startup proposal. The unpack procedure immediately moves the arm and applies only to its documented packed posture. Unknown or already-unpacked state must not trigger it. Preparing software or verifying SSH does not authorize unpacking or initialization; route that physical operation to [control](../omy-control/SKILL.md).

Report host/cwd, revision, connection/configuration evidence and pending steps. Without an authorized endpoint, provide commands/checks as unexecuted preparation.

Example: "Prepare OMY-F3M access from my user PC without moving the arm."
