# External-PC ROS 2 preparation

Source: [ROS 2 Communication](https://docs.robotis.com/docs/systems/aisapiens/development_guide/ros2_communication/), baseline 2026-10-23. The documented stack is ROS 2 Jazzy / rmw_zenoh_cpp. The external ai_sapiens container acts as a client of the verified robot Zenoh router.

Prepare the actual robot IP, route, selected container and expected ROS_DOMAIN_ID. In that process/container only, the documented form is:

```bash
# Replace robot_ip with the verified literal address before use; this is a template.
export ZENOH_CONFIG_OVERRIDE='transport/shared_memory/enabled=true;mode="client";connect/endpoints=["tcp/robot_ip:7447"]'
export RMW_IMPLEMENTATION=rmw_zenoh_cpp
```

Do not put the example in global shell startup or reuse another task's ROS domain. Matching environment and a socket connection do not prove feedback freshness or control readiness. Use the installed ROS CLI/help and current topic page to inspect expected message types, names and fresh samples before interpreting state. No data means check the real endpoint, router/service status and domain/environment first; do not start hardware services or publish commands as a diagnostic shortcut.

Explain the roles: rmw_zenoh_cpp adapts normal ROS 2 interfaces, rmw_zenohd is its router, and router/client configuration controls cross-host transport. Network access and startup are separate authorized operations. SDK-only state collection has a lighter prerequisite path in [SDK](sdk.md).
