# Read-only diagnostics and documented recovery

Start at [cycloctl](https://docs.robotis.com/docs/systems/aisapiens/development_guide/cycloctl/) or [Introduction navigation](https://docs.robotis.com/docs/systems/aisapiens/introduction/) for the exact ROS 2, topic structure and Python SDK pages. Recheck installed help before using version-specific flags.

Identify where the command runs: workstation, robot SBC or container. Robot host source /data/ai_sapiens is mounted at /root/ros2_ws/src/ai_sapiens in its container. cycloctl uses cyclod's local Unix socket and runs on the robot after authorized access; it is not a remote workstation robot-discovery tool.

Read-only service status on a verified, authorized robot:

```bash
cycloctl service status
cycloctl service logs --container ai_sapiens --name ai_sapiens_sim2real --tail 200
```

The bounded log command is documented; inspect current installed help if it differs. Service control is a mutation: do not run start/restart/stop or Wi-Fi mode switching to collect a status report. An authorized startup plan follows zenoh_daemon → ai_sapiens_bringup → ai_sapiens_sim2real, with readiness checks between them; shutdown reverses dependencies. Re-read exact commands and operator precautions at execution time. Do not infer readiness from elapsed time alone.

For missing STL: inspect submodule state and LFS checkout in the retargeter's AI Sapiens submodule. For MJCF issues use the upstream --check helper; --force overwrites and is not a generic repair. For task not found: verify selected backend, actual registered task IDs, custom config import and checkout version. For failed export: verify exact checkpoint/run and inspect script help; do not combine Lab --task/--checkpoint flags with MJLab's positional ID/--checkpoint-file.

For ROS 2/SDK work, inspect actual topics, schema and documented state/health reads first. A topic or API capable of publishing commands is live control and cannot be inferred safe from its name. Topic descriptions are not permission to publish. Network routing, Zenoh, ROS domain settings and SDK dependencies can affect other services; prepare isolated config diffs before changing them.

Report observed evidence, affected stage, proposed fix, remaining uncertainty and how to verify the fix. Do not invent a connection, SDK endpoint or successful service output when the executor cannot access it.

For read-only Python state collection, the [Python SDK guide](https://docs.robotis.com/docs/systems/aisapiens/development_guide/zenoh_ros2_sdk/) documents installing zenoh-ros2-sdk in a task-local venv and using ROS2Subscriber for topic /joint_states, msg_type sensor_msgs/msg/JointState, with a callback and subscriber.close() on exit. Use the current complete subscriber example rather than guessing an SDK health endpoint. Inspect equal-index joint arrays, freshness and actual received names before interpreting values. Configure only the authorized reachable router endpoint in this process's environment; do not copy the manual's example IP or persist settings globally. Set a bounded collection period in the task. Stop and report no data if the router/feedback is unavailable. Do not start robot services to obtain data without authorization. The same page's publisher example changes impedance commands; zero gains are still a command and are excluded from read-only diagnostics.
