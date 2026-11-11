# Connection planning

Source: [Networking](https://docs.robotis.com/docs/systems/aisapiens/development_guide/networking/), reviewed 2026-10-23. Use its port images; values below are documented defaults, not discovered endpoints.

For first access, choose USB device-mode networking or the external Ethernet port. USB normally assigns the PC an address in 192.168.55.0/24 and exposes the robot at 192.168.55.1. Ethernet through a router uses DHCP; resolve serial mDNS or inspect authorized DHCP inventory. The other Ethernet link is the internal HAT connection at 192.168.10.2/24: do not unplug/reconfigure it. Direct Linux/macOS links use the manual's host sharing setup; review the specific interface and rollback before any change.

AP and STA are mutually exclusive. Plan changes over verified USB/Ethernet access first; keep that recovery link. On an authorized robot session, read-only checks include:

```bash
cycloctl wifi status
ip --color address show wlan0
```

The documented mutation forms are `cycloctl wifi hotspot --ssid ... --password ...`, `cycloctl wifi connect --ssid ... --password ...`, and `cycloctl wifi stop`. These are syntax explanations, not copy-and-run credential examples. Do not request/output passwords in chat, save secrets, create an open AP, or change country/channel settings implicitly. Verify actual resulting mode/address; rollback uses the recorded previous configuration over the alternate link.

For SSH, read [identity checks](../../ai-sapiens-sim2real/references/deployment.md). DNS failure is not authorization to scan arbitrary networks or disable host-key verification.
