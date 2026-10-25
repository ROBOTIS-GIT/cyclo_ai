---
name: ai-sapiens-connectivity
description: Prepare AI Sapiens K1 USB, Ethernet, Wi-Fi AP/STA and verified SSH connection plans without changing network settings implicitly.
---

# Ai Sapiens Connectivity

Read [execution boundaries](../../references/execution.md) before commands or changes, and [official retrieval](../../references/sources.md) before factual guidance. Fetch only the relevant source and reference; do not load the whole manual. Preserve the user's instructions and authorization. This workflow has no GPU/robot executor or credential store; the separate firmware MCP cannot execute it.

1. For actual connection/configuration planning, establish host OS, available physical link and intended topology only when needed for the next decision. For explanation-only or status-method requests, answer directly without collecting unrelated setup details. Read [network](references/network.md) and the current Networking/SSH manuals. Distinguish a plan from authorized connection/configuration.
2. Prefer the documented USB/Ethernet bootstrap for an unconfigured Wi-Fi robot. Identify the user-facing port from the manual image; never change or disconnect the HAT's internal Ethernet link.
3. Read-only inspection and a proposed endpoint do not prove identity. For SSH use the serial/host-key/physical-label checks in [deployment](../ai-sapiens-sim2real/references/deployment.md). Do not guess factory credentials or disable verification. No registry or actual robot connection is supplied by the plugin.
4. Before any later authorized Wi-Fi mode change, prepare the exact AP/STA choice, impact on current access, saved configuration/rollback and a verified alternate USB/Ethernet recovery path. Avoid printing credentials in chat/logs. Do not create an open AP, firewall rule or persistent global network change as a shortcut.
5. Report actual observed status only. If no robot/host access exists, provide an operator-run checklist marked unexecuted. Route application-layer ROS 2 setup to [control](../ai-sapiens-control/SKILL.md) and service errors to diagnostics.

Examples: “USB로 처음 연결하려면?”; “AP랑 STA 중 뭘 써?”; “시리얼 호스트가 안 잡혀.”
