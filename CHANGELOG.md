# Changelog

## 0.5.0

- Separate development-session history from reusable product instructions while preserving default-disabled hardware and task-specific authorization.
- Permit bounded discovery on a port-only bus without predeclaring model/firmware/ID; add explicit, expiring observed-target selection and session-state inspection.
- Advance selected targets only after verified ID/baud transitions with full supported-snapshot continuity, confirmed closure and released bus reservation. Block writes after failure, uncertainty or changed context; never retry or silently retarget.
- Add customer onboarding through the existing Cyclo Skill and product/configuration/integration starter prompts, retaining all learning workflows and Skill names.
- Generate and validate an isolated mock-only ROS 2 arm/Xacro/controller scaffold and a separate DHI hardware review plan. Hardware acceptance remains unverified.

## 0.4.0

Added ROBOTIS portfolio/source routing, focused integration and DYNAMIXEL expert guidance, and the curated mock-tested DYNAMIXEL configuration module. Retained AI Sapiens workflows and the pinned firmware MCP.
