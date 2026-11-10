# OMY skills

Extend the user's selected product-specific, five-skill pattern to OMY: `omy`, `omy-setup`, `omy-control`, `omy-teleop` and `omy-learning`. Cover product guidance, installation/connections, ROS 2 control, operator input and demonstration learning.

## Approach

Reuse the existing focused-skill structure and a shared official source map. A single combined skill would reduce entrypoints but lose the task-specific discovery the user selected for AI Worker. Avoid copying AI Worker robot configs or K1 motion workflows.

## Constraints

English package content; current official OMY sources; preserve model/revision and robot-PC/user-PC roles. Distinguish packing-state-dependent movement from installation and diagnostics. Keep OMY-L100 Leader and OMY-F3M Follower distinct; verify installed OMY recording configs and inference support. Skill authoring does not authorize robot access, installations, training, publication or live-profile changes. No runtime, dependency, version or commit changes are required.

## Validation

Validate the five skills, UI metadata, local links and 24-skill package inventory. Independently exercise host placement, packed state, offline diagnosis, teleoperation/inference transition and missing-source scenarios. Rebuild and validate the source archive. Hardware and training runtime remain untested.
