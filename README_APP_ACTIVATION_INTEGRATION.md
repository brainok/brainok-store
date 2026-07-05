# Brainok App Firebase Activation Integration

이 문서는 Brainok Store에서 생성한 Firebase Brainok License 코드를 다른 Brainok 앱들이 동일하게 받아들이도록 변경할 때 사용하는 이식 가이드입니다.

목표는 앱마다 별도 라이선스 시스템을 만들지 않고, 하나의 Brainok License로 모든 Brainok 앱을 활성화하는 것입니다.

## Current Production Rules

- Store URL: `https://store.brainok.net`
- Firebase project: `braionk-lab`
- Firebase Functions region: `asia-northeast3`
- Activation callable: `activateBrainokLicense`
- HTTPS callable endpoint: `https://asia-northeast3-braionk-lab.cloudfunctions.net/activateBrainokLicense`
- Support email: `brainok777@gmail.com`

앱은 Firestore의 `/licenses` 또는 `/activations`를 직접 읽지 않습니다. 앱은 activation function만 호출하고, 성공 결과를 로컬에 저장한 뒤 오프라인으로 동작해야 합니다.

## Non-Negotiable Requirements

- DMG, ZIP, EXE 같은 다운로드 파일은 보호하지 않습니다.
- 다운로드에는 로그인, 이메일, 결제가 필요 없어야 합니다.
- 앱은 30일 전체 기능 trial을 유지합니다.
- Trial 이후에만 activation을 요구합니다.
- Activation에는 인터넷이 한 번만 필요합니다.
- Activation 성공 후에는 앱이 완전히 오프라인으로 동작해야 합니다.
- 기존 shared activation code와 signed activation code는 계속 동작해야 합니다.
- Device limit은 Firebase license 문서에서 관리합니다. 앱에 하드코딩하지 않습니다.

기존 호환 코드:

```text
BRAINOK-SEVERANCE-2026
XJD2-FBYT-F6QA
```

## App Integration Checklist

1. 앱의 기존 `LicenseManager`, `ActivationView`, `ActivationWindowController` 위치를 찾습니다.
2. 기존 trial 로직은 유지합니다.
3. 기존 shared code와 signed code 검증 로직은 삭제하지 않습니다.
4. 기존 offline activation 검증을 먼저 시도합니다.
5. 기존 검증이 실패하면 Firebase `activateBrainokLicense`를 호출합니다.
6. Firebase activation이 성공하면 결과를 Keychain 또는 OS 보안 저장소에 저장합니다.
7. 저장된 Firebase activation은 이후 오프라인 상태에서도 valid로 처리합니다.
8. Activation 성공 후 UI 상태 변경 알림은 반드시 main thread에서 보냅니다.
9. Activation code 입력 UI는 dark mode에서 글자가 확실히 보이게 만듭니다.
10. 빌드 후 old code, invalid Firebase code, valid Firebase code를 모두 테스트합니다.

## Recommended App Metadata

각 앱은 stable `appId`를 사용해야 합니다. 앱 이름을 Firebase Console의 web app display name과 맞출 필요는 없습니다.

추천 예시:

| App | appId | appName |
| --- | --- | --- |
| Hotkey Launcher | `brainok-hotkey-launcher` | `Hotkey Launcher` |
| Brainok Clipboard | `brainok-clipboard` | `Brainok Clipboard` |
| PageWheel | `pagewheel` | `PageWheel` |
| Multiple File Viewer | `multiple-file-viewer` | `Multiple File Viewer` |

새 앱은 출시 후 바꾸기 어려우므로 처음부터 stable `appId`를 정합니다.

## Callable Request

macOS 앱에서 직접 Firebase SDK를 붙이지 않아도 HTTPS callable protocol로 호출할 수 있습니다.

```http
POST https://asia-northeast3-braionk-lab.cloudfunctions.net/activateBrainokLicense
Content-Type: application/json
```

```json
{
  "data": {
    "licenseCode": "BRAINOK-PERSONAL-XXXX-XXXX",
    "deviceId": "stable-device-id",
    "deviceName": "Hyosuk's MacBook Pro",
    "appId": "brainok-hotkey-launcher",
    "appName": "Hotkey Launcher",
    "os": "mac",
    "appVersion": "2.03"
  }
}
```

`code`와 `licenseCode` 둘 다 서버에서 허용하지만, 새 앱은 `licenseCode`를 사용합니다.

## Callable Success Response

Firebase callable은 성공 시 `result` 안에 activation 결과를 반환합니다.

```json
{
  "result": {
    "ok": true,
    "activated": true,
    "activatedDate": "2026-07-05T13:00:00.000Z",
    "licenseId": "lic_abc123",
    "licenseCode": "BRAINOK-PERSONAL-XXXX-XXXX",
    "plan": "personal",
    "status": "active",
    "maxDevices": 3,
    "deviceId": "stable-device-id"
  }
}
```

앱은 이 값을 로컬 activation payload로 저장합니다. `maxDevices`는 UI 표시나 support diagnostics에는 사용할 수 있지만, 실제 제한 판단은 서버가 합니다.

## Callable Error Response

오류는 Firebase callable 형식으로 내려옵니다.

```json
{
  "error": {
    "message": "License code does not exist.",
    "status": "NOT_FOUND"
  }
}
```

앱은 `error.message`를 사용자에게 보여주면 됩니다. 대표 메시지:

- `License code does not exist.`
- `This license is not active.`
- `Device limit reached (3).`
- `A valid Brainok license code is required.`

## Swift Implementation Shape

각 앱의 구조는 다를 수 있지만 activation 순서는 같아야 합니다.

```swift
func activate(code rawCode: String, completion: @escaping (Result<Void, Error>) -> Void) {
    let code = rawCode.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()

    if activateExistingOfflineCode(code) {
        publishLicenseStateChangeOnMainThread()
        completion(.success(()))
        return
    }

    activateBrainokLicenseWithFirebase(code: code) { result in
        switch result {
        case .success(let payload):
            saveLicenseToKeychain(payload)
            publishLicenseStateChangeOnMainThread()
            completion(.success(()))

        case .failure(let error):
            completion(.failure(error))
        }
    }
}
```

The important order:

```text
existing offline code
  -> existing signed code
  -> Firebase Brainok License
  -> local offline cache
```

Do not replace the old path with the Firebase path. Add Firebase as a new fallback path.

## Local Storage

macOS recommended storage:

- Keychain for activation payload.
- App Support JSON only for non-secret metadata if needed.

Windows recommended storage:

- Windows Credential Manager or DPAPI-protected local file.

Recommended stored fields:

```json
{
  "licenseCode": "BRAINOK-PERSONAL-XXXX-XXXX",
  "licenseId": "lic_abc123",
  "plan": "personal",
  "deviceId": "stable-device-id",
  "activatedAt": "2026-07-05T13:00:00.000Z",
  "source": "brainok_license"
}
```

`source: "brainok_license"`를 저장하면 기존 signed/shared activation과 구분하기 쉽습니다.

## Main Thread Rule

URLSession callback은 background thread에서 실행될 수 있습니다. Activation 성공 후 AppKit 또는 SwiftUI 상태를 바꾸는 notification을 background thread에서 보내면 앱이 crash할 수 있습니다.

항상 main thread로 넘긴 뒤 상태를 갱신합니다.

```swift
private func publishLicenseStateChangeOnMainThread() {
    let publish = {
        self.refresh()
        NotificationCenter.default.post(name: .licenseStateDidChange, object: nil)
    }

    if Thread.isMainThread {
        publish()
    } else {
        DispatchQueue.main.async(execute: publish)
    }
}
```

## Activation UI Requirements

Activation UI는 최소한 다음 요소를 가져야 합니다.

- 앱 이름과 activation 상태
- Trial 남은 일수 또는 activated 상태
- Activation code 입력 필드
- `Paste from Clipboard` 버튼
- Device ID 표시
- `Copy` 버튼
- 에러 메시지 영역
- `Activate` 버튼

Dark mode에서 글씨가 안 보이는 문제가 생기지 않도록 code input은 명시적으로 색상을 지정합니다.

Recommended macOS AppKit styling:

- `NSTextField` 또는 제대로 색상을 지정한 `NSTextView`
- text color: `.labelColor` 또는 `.white`
- background: dark rounded container
- insertion point color가 보이도록 current appearance에서 테스트
- large multiline input 대신 단일 license code라면 `NSTextField` 선호

Recent File Launcher 스타일처럼 paste 버튼과 큰 입력 박스를 제공하면 support가 쉬워집니다.

## Firebase Console Tasks

다른 앱을 추가할 때 Firebase Console에서 매번 새 DB를 만들 필요는 없습니다.

확인할 것:

1. Project가 `braionk-lab`인지 확인합니다.
2. Functions에 `activateBrainokLicense`가 `asia-northeast3`로 배포되어 있는지 확인합니다.
3. Firestore `/licenses/{licenseCode}` 문서가 생성되어 있는지 확인합니다.
4. Universal license라면 `allowedApps`는 보통 `["*"]`입니다.
5. Plan별 `maxDevices`가 올바른지 확인합니다.
6. App client가 Firestore를 직접 읽으려 하지 않는지 확인합니다.

앱 이름을 Firebase web app display name에 맞춰 바꿀 필요는 없습니다. 앱에서 중요한 값은 activation request의 `appId`와 `appName`입니다.

## Validation Commands

macOS Swift 앱 예시:

```bash
swift build -c release
```

Invalid code endpoint test:

```bash
curl -s \
  -H 'Content-Type: application/json' \
  -d '{"data":{"licenseCode":"INVALID-CODE","deviceId":"TEST-DEVICE","appId":"brainok-test","appName":"Brainok Test","os":"mac","appVersion":"0.0.0"}}' \
  https://asia-northeast3-braionk-lab.cloudfunctions.net/activateBrainokLicense
```

Expected invalid response includes:

```text
License code does not exist.
```

## Manual QA Checklist

- Fresh install starts 30-day trial.
- Old shared code still activates.
- Old signed activation code still activates.
- Invalid Firebase license shows a readable error.
- Valid Firebase license activates once online.
- App quits and relaunches as activated.
- Network disabled after activation still shows activated.
- Activation UI text is visible in dark mode.
- Device ID copy button works.
- Paste button fills the activation field.
- Activation success does not crash the app.

## Codex Prompt For Future Apps

Use this prompt when converting another Brainok app:

```text
이 앱의 기존 licensing/trial 구조를 먼저 분석해줘.

Brainok Store Firebase universal license를 추가하되, 기존 shared activation code와 signed activation code 호환성은 절대 깨지지 않게 유지해줘.

Firebase activation은 기존 offline activation 검증 실패 후 fallback으로 호출해줘.

Callable endpoint:
https://asia-northeast3-braionk-lab.cloudfunctions.net/activateBrainokLicense

Request data:
- licenseCode
- deviceId
- deviceName
- appId
- appName
- os
- appVersion

성공하면 source가 brainok_license인 local activation payload를 Keychain 또는 OS 보안 저장소에 저장하고, 이후에는 완전히 offline으로 activated 상태가 유지되게 해줘.

Activation 성공 후 notification 또는 UI state 변경은 반드시 main thread에서 실행해줘.

Activation UI는 Hotkey Launcher/Recent File Launcher 스타일처럼 글씨가 잘 보이는 입력 필드, Paste from Clipboard, Device ID Copy, 에러 메시지, Activate 버튼을 포함하게 해줘.

빌드 후 다음을 확인해줘:
- 기존 shared code 동작
- 기존 signed code 동작
- invalid Firebase code 에러 표시
- valid Firebase code activation
- 재실행 후 offline activated 상태 유지
- dark mode에서 activation code 글씨가 보임
```

