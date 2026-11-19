0.2.1 (2026-11-12)
------------------
* Added self-contained OpenAI and Claude plugin packages with cross-platform
  installation verification and signed Claude distribution publishing.
* Added release-only package builds and automated GitHub Release and Discord
  notifications.
* Fixed Windows Python tool launching and streamlined CI and tests.
* Contributors: Taehun Lim

0.2.0 (2026-11-11)
------------------
* Added shared Codex and Claude Code plugins with 28 task-specific skills for
  DYNAMIXEL actuators, AI Worker, OMY, OMX, and AI Sapiens.
* Added the local cyclo-mcp server for official-source model selection, device
  discovery, Control Table inspection, and supported configuration changes.
* Added source-bound Control Table contracts covering 89 actuator documents,
  with model, firmware, operating mode, and write prerequisite checks.
* Added single and batch target selection, read-only access, automatic read
  batching, and verified ID and baud rate transitions on multi-device buses.
* Added custom Control Table import and review for actuators, controllers, and
  sensors, with serial, TCP, and UDP transport support.
* Added ROS 2 integration and configuration inspection, teleoperation and
  learning guidance, and AI Sapiens motion, walking, and Sim2Real preparation.
* Added local environment setup and diagnostics, reproducible source archives,
  Apache-2.0 licensing, and offline validation across supported platforms.
* Contributors: Woojin-Crive, Taehun Lim
