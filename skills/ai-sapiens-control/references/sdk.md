# Bounded read-only state collection

Source: [Python SDK](https://docs.robotis.com/docs/systems/aisapiens/development_guide/zenoh_ros2_sdk/), baseline 2026-10-23. zenoh-ros2-sdk subscribes without ROS 2/Docker. Prepare a task-local venv, installed-version API check and verified process-only Zenoh endpoint before authorized connection. This adapted subscriber was syntax-checked, not SDK-executed:

```python
import os
import time
if not os.environ.get("ZENOH_CONFIG_OVERRIDE"):
    raise SystemExit("Provide verified process-local Zenoh configuration first")
from zenoh_ros2_sdk import ROS2Subscriber
samples = 0

def show(message):
    global samples
    names = list(message.name)
    arrays = [list(message.position), list(message.velocity), list(message.effort)]
    if any(values and len(values) != len(names) for values in arrays):
        print("Malformed populated joint arrays")
        return
    samples += 1
    print(time.monotonic(), message.header.stamp, names, *arrays)

reader = ROS2Subscriber(topic="/joint_states",
                        msg_type="sensor_msgs/msg/JointState", callback=show)
try:
    time.sleep(5)
finally:
    reader.close()
print("samples:", samples)
if not samples:
    print("No received state evidence; do not claim communication success")
```

Five seconds is the wait after construction, not a bound on connection/shutdown. Optional JointState arrays may be empty; populated arrays must align with names. Freshness interpretation needs clock/delay evidence. Never substitute a command publisher when no samples arrive; even zero impedance gains change control. No SDK installation, import or robot connection was performed here.
