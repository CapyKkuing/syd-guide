# D1 암호화 백업·복원 절차

## 현재 승인 경계

현재 승인된 범위는 로컬 스크립트와 문서 검증, 공식 `age` 설치, 비밀번호로 암호화한 외장하드 개인키와 공개 recipient 생성까지 완료했다.

다음 작업은 각각 별도 승인이 있어야 실행한다.

- 운영 D1 export
- Google Drive 업로드
- 별도 테스트 D1 생성
- 원격 테스트 D1 복원과 조회
- Windows 작업 스케줄러 등록

운영 D1에는 복원 명령을 실행하지 않는다.

## 구조

1. `wrangler d1 export <database> --remote`로 전체 schema와 데이터를 SQL로 내보낸다.
2. 평문 SQL은 Git 프로젝트 밖의 `D:` 전용 임시 폴더에만 둔다.
3. `age` 공개키 recipient로 암호화한다.
4. 스크립트가 평문과 실패한 부분 파일을 즉시 삭제한다.
5. 완성된 `.sql.age` 파일 하나만 비공개 Google Drive에 수동 업로드한다.
6. 복원은 migration을 적용하지 않은 새 빈 테스트 D1에만 수행한다.

> Windows와 SSD에서는 `Remove-Item`만으로 물리적 안전 삭제를 보장할 수 없다. 사용자는 현재 개인 여행 앱 범위에서 BitLocker·EFS·VeraCrypt를 사용하지 않고 이 잔여 위험을 수용했다. 평문은 `D:` 전용 임시 폴더에만 만들고 즉시 `age` 암호화한 뒤 `finally`에서 삭제한다. 삭제된 평문의 물리적 복구 불가능까지 보장하지는 않는다.

## 1. 계획 모드 확인

다음 명령은 실제 D1이나 Drive를 변경하지 않는다. 앞으로 실행될 경계만 표시한다.

```powershell
powershell -NoProfile -File .\scripts\backup-d1.ps1 `
  -DatabaseName "couple-travel-guide" `
  -RecipientFile "D:\TravelGuideRecovery\recipients.txt" `
  -OutputDirectory "D:\TravelGuideBackups" `
  -AgeCommand "<installed-age-directory>\age.exe"
```

복원 계획도 원격 작업 없이 확인한다.

```powershell
powershell -NoProfile -File .\scripts\restore-d1-test.ps1 `
  -EncryptedBackupPath "D:\TravelGuideBackups\backup.sql.age" `
  -IdentityFile "E:\TravelGuideRecovery\key.age" `
  -WorkDirectory "D:\TravelGuideRestoreTemp" `
  -TestDatabaseName "couple-travel-guide-restore-test" `
  -ProductionDatabaseName "couple-travel-guide" `
  -AgeCommand "<installed-age-directory>\age.exe"
```

## 2. 키 준비

공식 `age` v1.3.1 설치와 USB 외장하드 `E:`의 암호화 개인키 생성은 완료했다. 재생성이 필요하면 기존 키를 덮어쓰지 말고 사고 대응 절차에 따라 별도 승인 뒤 실행한다.

현재 설치본은 PATH에서 확인된다. 실행 직전에 `$AgeCommand = (Get-Command age.exe -ErrorAction Stop).Source`로 실제 절대 경로를 구해 `-AgeCommand $AgeCommand`로 전달한다. 비밀번호나 개인키 값은 명령 인자에 넣지 않는다.

```powershell
powershell -NoProfile -File .\scripts\create-age-key.ps1 `
  -ExternalDriveRoot "E:\" `
  -AgeDirectory "<installed-age-directory>" `
  -RecipientFile "D:\TravelGuideRecovery\recipients.txt"
```

- `key.age`: 비밀번호로 암호화된 개인키. Git, 프로젝트 폴더, Google Drive 밖의 외장하드에 보관한다.
- 생성 과정에서 표시되는 `age1...` 공개 recipient만 `D:\TravelGuideRecovery\recipients.txt`에 저장한다. `AGE-SECRET-KEY-...` 값은 파일·로그·스크린샷에 남기지 않는다.
- 비밀번호와 외장하드의 `key.age`를 모두 잃으면 기존 백업은 복구할 수 없다. 비밀번호는 키 파일과 다른 위치에 보관한다.
- 키 파일 내용은 로그·스크린샷·문서에 복사하지 않는다.

## 3. 운영 백업 실행

운영 export 승인 뒤에만 `-ExecuteRemoteExport`를 붙인다.

```powershell
powershell -NoProfile -File .\scripts\backup-d1.ps1 `
  -DatabaseName "couple-travel-guide" `
  -RecipientFile "D:\TravelGuideRecovery\recipients.txt" `
  -OutputDirectory "D:\TravelGuideBackups" `
  -WranglerConfig ".\wrangler.jsonc" `
  -AgeCommand "<installed-age-directory>\age.exe" `
  -AcceptUnencryptedTemporaryFiles `
  -ExecuteRemoteExport
```

성공 결과에서 다음만 기록한다.

- 실행 UTC 시각
- 암호화 파일 이름
- 암호화 파일 크기
- SHA-256
- 평문 제거 성공 여부
- 암호화되지 않은 디스크의 안전 삭제 미보장 확인

`.sql`, `.partial`, 개인키는 Drive에 올리지 않는다.

## 4. Drive 수동 업로드

V1 첫 검증은 브라우저의 기존 Drive 연결과 분리해 수동으로 수행한다.

1. 비공개 전용 폴더 `Backups/couple-travel-guide`를 만든다.
2. `.sql.age` 파일 하나만 업로드한다.
3. 링크 공유가 꺼져 있는지 확인한다.
4. 로컬 파일과 Drive 다운로드 파일의 SHA-256을 비교한다.
5. 암호화 파일 이름·크기·SHA-256을 실행 기록에 남긴다.

무인 Drive 업로드는 refresh token 보관 정책과 별도 OAuth 범위를 승인한 뒤 후속 Phase로 분리한다.

## 5. 빈 테스트 D1 복원

전체 export에는 schema가 들어 있으므로 migration을 미리 적용하지 않은 새 빈 D1을 사용한다.

테스트 D1 생성은 별도 승인 뒤 수행한다.

```powershell
npx wrangler d1 create couple-travel-guide-restore-test
```

실제 복원에는 실행 스위치와 두 확인 스위치가 모두 필요하다. 하나는 복원 동작 확인이고, 다른 하나는 Cloudflare 화면에서 새 빈 테스트 D1임을 확인했다는 명시적 확인이다.

```powershell
powershell -NoProfile -File .\scripts\restore-d1-test.ps1 `
  -EncryptedBackupPath "D:\TravelGuideBackups\backup.sql.age" `
  -IdentityFile "E:\TravelGuideRecovery\key.age" `
  -WorkDirectory "D:\TravelGuideRestoreTemp" `
  -TestDatabaseName "couple-travel-guide-restore-test" `
  -ProductionDatabaseName "couple-travel-guide" `
  -WranglerConfig ".\wrangler.jsonc" `
  -AgeCommand "<installed-age-directory>\age.exe" `
  -AcceptUnencryptedTemporaryFiles `
  -ExecuteTestRestore `
  -ConfirmTestDatabaseRestore `
  -ConfirmEmptyTestDatabase
```

스크립트는 다음 경우 실행을 거부한다.

- 테스트 DB와 운영 DB 이름이 같음
- 테스트 DB 이름에 `test`, `restore`, `qa`가 없음
- `-ConfirmTestDatabaseRestore` 또는 `-ConfirmEmptyTestDatabase` 중 하나만 지정함
- 실제 실행에서 `-AcceptUnencryptedTemporaryFiles`가 없음
- 암호화 백업 파일이 `.sql.age`가 아님
- 작업 폴더가 Git 프로젝트 안에 있음
- 백업·recipient·작업 폴더가 승인된 `D:` 경계를 벗어남
- 암호화 identity가 승인된 `E:` 경계를 벗어남
- recipient가 단일 `age1...` 공개키 형식이 아님
- 백업 또는 identity가 `age-encryption.org/v1` 형식이 아님

## 6. 복원 검증

원격 읽기 승인을 받은 뒤 운영 export 직전과 테스트 D1 복원 뒤에 사용자 테이블 27개의 수를 모두 확인한다. `_cf_KV`, `d1_migrations`, `sqlite_*`는 Cloudflare·SQLite 메타데이터라 비교에서 제외한다.

```sql
SELECT 'activity_logs' AS table_name, COUNT(*) AS row_count FROM activity_logs
UNION ALL SELECT 'app_settings', COUNT(*) FROM app_settings
UNION ALL SELECT 'bookings', COUNT(*) FROM bookings
UNION ALL SELECT 'check_items', COUNT(*) FROM check_items
UNION ALL SELECT 'data_imports', COUNT(*) FROM data_imports
UNION ALL SELECT 'device_sessions', COUNT(*) FROM device_sessions
UNION ALL SELECT 'expenses', COUNT(*) FROM expenses
UNION ALL SELECT 'members', COUNT(*) FROM members
UNION ALL SELECT 'mutation_receipts', COUNT(*) FROM mutation_receipts
UNION ALL SELECT 'notes', COUNT(*) FROM notes
UNION ALL SELECT 'pair_invites', COUNT(*) FROM pair_invites
UNION ALL SELECT 'place_provider_usage', COUNT(*) FROM place_provider_usage
UNION ALL SELECT 'places', COUNT(*) FROM places
UNION ALL SELECT 'schedule_items', COUNT(*) FROM schedule_items
UNION ALL SELECT 'settlement_expense_claims', COUNT(*) FROM settlement_expense_claims
UNION ALL SELECT 'settlement_transfers', COUNT(*) FROM settlement_transfers
UNION ALL SELECT 'trip_booking_storage', COUNT(*) FROM trip_booking_storage
UNION ALL SELECT 'trip_days', COUNT(*) FROM trip_days
UNION ALL SELECT 'trip_media', COUNT(*) FROM trip_media
UNION ALL SELECT 'trip_media_storage', COUNT(*) FROM trip_media_storage
UNION ALL SELECT 'trip_members', COUNT(*) FROM trip_members
UNION ALL SELECT 'trips', COUNT(*) FROM trips
UNION ALL SELECT 'vision_ocr_usage', COUNT(*) FROM vision_ocr_usage
UNION ALL SELECT 'votes', COUNT(*) FROM votes
UNION ALL SELECT 'weather_current_snapshots', COUNT(*) FROM weather_current_snapshots
UNION ALL SELECT 'weather_forecast_snapshots', COUNT(*) FROM weather_forecast_snapshots
UNION ALL SELECT 'weather_provider_usage', COUNT(*) FROM weather_provider_usage;
```

검증 항목:

- 운영 export 직전 원본 27개 사용자 테이블 count와 테스트 D1 count가 모두 일치함
- 표본 여행의 날짜·일정 순서·참여자·예약·장소가 일치함
- 대표사진과 릴 metadata 참조가 유효함
- 테스트 D1 조회만 수행했고 운영 D1은 변경하지 않음
- 작업 폴더에 평문 `.sql`이 남지 않음

## 실행 기록 양식

```text
실행일:
실행자:
운영 DB:
암호화 백업 파일:
크기 / SHA-256:
Drive 폴더 / 공유 상태:
테스트 D1:
핵심 row count 대조:
표본 데이터 대조:
평문 잔존 확인:
운영 DB 비변경 확인:
결론:
```
