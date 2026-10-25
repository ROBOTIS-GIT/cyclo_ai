# Independent Cyclo Plugin 0.5.0 review

Date: 2026-10-25. Reviewed the actual working tree at `/home/hc/Documents/Codex/2026-10-23/task/proart-ai-sapiens-development/cyclo-plugin`. Project source was not edited. All test I/O used injected fixtures or temporary generated files. No real serial discovery/device operation, OpenRB use, ROS/Zenoh robot connection, GPU job, global installation or credential access occurred.

## Findings requiring correction

1. **Generated ROS controller parameter wiring is incomplete.** In `scripts/prepare_ros2_mock.py`, the `forward_position_controller` spawner does not receive `--param-file controllers.yaml`. The controller-specific `joints` parameters are only in the `forward_position_controller` YAML node, while the file is passed only to `ros2_control_node`. No controller `params_file` is configured on the manager either. This can leave the later spawned controller without its required joints list, even though XML/YAML/AST tests pass. The Jazzy spawner's own implementation explicitly loads controller parameter files passed through `-p/--param-file` or its own ROS `--params-file`: https://raw.githubusercontent.com/ros-controls/ros2_control/jazzy/controller_manager/controller_manager/spawner.py . Pass the same generated YAML to the spawner and add an AST assertion for that dependency. This is a source-backed configuration defect; ROS runtime reproduction was unavailable and was not claimed.
2. **One remaining session-specific Skill sentence.** `skills/ai-sapiens-walking/SKILL.md` step 3 still says: “For this package's development/evaluation task they are not authorized.” That development-history sentence belongs in producer evidence rather than a reusable customer Skill. Permanent scope/authorization safeguards should remain.

No unsafe write/retarget defect was observed in the reviewed state-management paths. The explicit hardware-disabled default, operation permission checks, one-candidate selection, user confirmation/isolation, expired/cross-session/context-invalid token rejection, identity checks, closure/lease conditions and write lock after failure are coherent. Full snapshot continuity remains a heuristic on a physically isolated bus, not a unique serial identity proof; the first-run reference explicitly discloses that limit.

## Executed checks

- `node --test tests/selection.test.mjs tests/dynamixel.test.mjs tests/products-integration.test.mjs`: **40 passed**, no skipped/cancelled/failing tests. This includes actual local stdio initialize/list/call with injected fixtures; it is not installed-host invocation.
- `CYCLO_XACRO_TEST_PATH=/tmp/cyclo-v050-python PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s validation -p test_ros2_artifacts.py -v`: **3 passed**. This expands the generated Xacro with actual Xacro and checks XML/YAML/AST mappings and preservation of existing files; it does not run ROS.
- Additional isolated adversarial probe: after a mock ID write, changed the destination's unchanged Drive Mode snapshot while retaining the same model/firmware/new ID. `configure` returned `uncertain`, `Transition continuity mismatch: drive; stop without retargeting`, exactly one write, and confirmed closure. Settling that result retained the old location and changed the target to `reconciliation-required`. Thus an ID response alone did not count as continuity or silently advance the handle.

## Independent forward responses

These responses were produced from the packaged Skills/references without supplied expected wording. They are a model-response evaluation, not host-installed acceptance. Current producer restrictions were respected during evaluation.

### 처음 연결했는데 ID를 몰라. 설정 도와줘

ID를 몰라도 먼저 포트만 지정한 버스에서 제한된 읽기 스캔을 준비할 수 있습니다. 어떤 어댑터와 통신 방식(TTL 또는 RS-485)을 쓰고 있나요? 장치 접근이 허용된 작업이라면 사용할 어댑터를 확인한 뒤 작은 ID·baud 범위를 먼저 보여드리겠습니다.

응답이 없으면 범위·전원·배선을 확인하고, 여러 장치가 나오면 원하는 장치를 분리해서 다시 확인합니다. 한 개가 보여도 자동 선택하지 않습니다. 모델·펌웨어를 확인하고 대상 선택과 단일 장치 분리를 확인받은 뒤 설정 계획으로 넘어갑니다. 포트 탐색만 허용했다고 쓰기 권한까지 생기지는 않습니다.

Observed behavior: unknown ID is not a blocker to a port-only scan plan; no automatic discovery in an explanation; zero/one/multiple responses distinguished; configuration grant remains separate.

### ID 7로 바꿨어. 이제 LED 켜줘

같은 세션에서 변경 결과가 검증되었다면 선택 대상의 현재 ID가 7로 갱신되어 있으므로 그 대상을 이어서 사용할 수 있습니다. 먼저 장치에 접속하지 않는 `dynamixel_targets`에서 대상이 `ready`이고 현재 ID가 7인지 확인하겠습니다. 이후 허용된 LED 변경을 dry run으로 확인하고, 실제 실행 때도 모델·펌웨어와 현재 위치를 다시 검증합니다.

사용자 말씀만 있고 검증된 세션 결과가 없거나 상태가 `reconciliation-required`라면 ID 7을 임의로 새 대상에 붙이지 않습니다. 종료·버스 독점 상태를 확인하고 읽기 스캔과 명시적 선택으로 다시 식별해야 합니다. 이 모듈은 토크를 켜거나 위치 명령을 보내지 않습니다.

Observed behavior: verified session continuity avoids stale-ID reuse; an asserted ID alone is not accepted as verified continuity; uncertain writes are not repeated.

### 로봇 팔 ROS2 control과 DHI Xacro 준비해줘

사용 중인 로봇 팔 모델, ROS 배포판, 실제 URDF/Xacro와 관절–DYNAMIXEL 매핑을 먼저 확인하겠습니다. DYNAMIXEL SDK는 패킷 통신, DHI는 장치와 ros2_control 사이의 하드웨어 계층이며, 제어기와 Zenoh는 별도 역할입니다.

실물 정보가 아직 없으면 Jazzy용 mock scaffold를 별도 빈 폴더에 만들 수 있습니다. 생성물은 Xacro, controller YAML, mock 전용 launch와 DHI 검토 계획이며, 실제 DHI 드라이버나 모터를 실행하지 않습니다. Xacro 전개와 관절·인터페이스·컨트롤러 매핑을 먼저 검증하고, 실제 bringup은 버전·배선·모델 테이블·토크 동작을 검토한 별도 단계로 남깁니다. 합성 예제의 치수·제한을 제품 보정값으로 사용하지 않습니다.

Observed behavior: asks for missing real platform inputs and distinguishes mock configuration from DHI/ROS runtime. Code review found the parameter-wiring defect above despite this sensible response.

### 다이나믹셀 추천해줘

어떤 용도인지부터 알려주세요. 필요한 연속 부하/토크와 속도, 공급 전압, TTL·RS-485 중 통신 방식, 크기·무게와 사용 환경이 모델 선택에 영향을 줍니다. 그 조건으로 정확한 모델의 공식 사양을 비교하겠습니다. stall torque만으로 연속 운전 가능 여부를 판단하거나, 문서가 있다는 이유로 현재 판매·호환성을 단정하지 않겠습니다. 제품을 추천하는 데 장치 연결은 필요하지 않습니다.

Observed behavior: targeted clarification rather than an unsupported concrete recommendation; official-model source retrieval is the next step; no hardware call.

### AI Sapiens 보행 학습 준비해줘

Cyclo Lab과 Cyclo MJLab 중 어느 환경을 사용할까요? Cyclo Lab은 Isaac Lab 기반, MJLab은 MuJoCo 기반 준비 절차를 따릅니다. 이미 선택한 환경이나 기존 프로젝트가 있으면 그것을 유지하겠습니다.

환경을 정하면 OS·GPU/드라이버·컨테이너 도구·저장 공간과 실제 실행기를 확인하고, 그 버전에 맞는 준비 명령과 작은 환경 확인 절차를 만들겠습니다. 플러그인 설치가 GPU를 제공하는 것은 아니며, 문서의 큰 학습 예제를 자동 시작하지 않습니다. 실험적 Isaac/Newton 브랜치는 기본 안정 경로와 구분합니다.

Observed behavior: preserves the backend choice and learning workflows, no assumed GPU or training execution. The residual development-task sentence in the Skill should still be removed.

## Remaining evidence boundary

No installed Codex host installation/discovery/invocation was tested by this independent reviewer. No full ROS controller runtime, simulator task runtime, GPU training or physical-device acceptance was tested. The default hardware capability matrix was not expanded or recertified by these results.

## Follow-up verification of reported fixes

Both reported defects were corrected in the subsequently inspected working tree. The walking Skill's step 3 now retains scope-appropriate authorization without the producer-session prohibition. Both generated controller spawners now pass `--param-file` with `str(root / "controllers.yaml")`, and the artifact test parses each spawner's AST arguments to assert that exact file dependency. The generated spawners also have a bounded controller-manager wait.

Re-ran the affected actual-Xacro/artifact test file after those changes: **3 tests passed**. No new defect was observed in the affected fixes. This confirms source wiring and offline generated artifacts; no ROS runtime or hardware acceptance was added to the evidence.

## Final target-grant guard follow-up

Read the added `TargetSession.select` guard and ran the selection suite: **7 tests passed**, including rejection of a different supported model/firmware pair, a different ID and a different rate when the scan derives from a target-specific grant. The check runs before binding verification and target creation. Port-only buses remain the explicit operator-granted path for selecting an initially unknown supported identity; a scan-only bus cannot acquire configuration rights.

An additional isolated assertion verified the interaction with session continuation: after a verified, closed/released transition from ID1/57600 to ID7/1000000, a matching scan under the updated target grant can be explicitly selected into a new handle, whereas the old ID1/57600 observation is rejected as outside the current target-specific grant. No device I/O occurred. No new defect was observed in this permission correction.
