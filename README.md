# Gangdong Meal Map

강동역 인근 회사 식권 사용 가능 식당을 카테고리 기반 treemap으로 탐색하는 정적 웹앱입니다.

사이트는 아침, 점심, 저녁 식당을 토글로 전환해서 볼 수 있고, 식당 클릭 상세보기, 카테고리 드래그 이동, 랜덤 픽 애니메이션, 로컬 DB 수정 기능을 포함합니다.

## Features

- 아침 / 점심 / 저녁 식당 treemap 시각화
- 카테고리별 식당 밀집도 확인
- 식당 클릭 상세보기
- 검색
- 랜덤 선택 애니메이션
- 카테고리 드래그 이동
- 사이드바 드래그 삭제
- 브라우저 `localStorage` 기반 로컬 편집 저장

## Project Structure

- `index.html`
  UI 구조
- `styles.css`
  테마, 레이아웃, 모션, 사이드바 스타일
- `app.js`
  treemap 렌더링, 드래그 앤 드롭, 랜덤 픽, 상세 패널 동작
- `database.js`
  원본 식당 데이터와 보정 정보

## Data Model

`database.js`는 아래 구조를 사용합니다.

- `rawSources`
  아침 / 점심 / 저녁 원본 식당 리스트
- `corrections`
  OCR 오타나 표기 차이를 실제 상호명으로 통합하는 매핑
- `profiles`
  카테고리, 메뉴군, 대표메뉴, 태그 정보

앱 실행 중 수정되는 데이터는 브라우저 `localStorage`에 저장됩니다.

- `profileOverrides`
  기존 식당의 로컬 수정값
- `customRestaurants`
  새로 추가한 식당
- `deletedRestaurants`
  화면에서 삭제 처리한 식당

## Run Locally

정적 파일만으로 동작하므로 아래 중 아무 방식으로든 열면 됩니다.

1. 브라우저에서 `index.html` 직접 열기
2. 간단한 정적 서버 실행

예시:

```powershell
python -m http.server 8000
```

그 후 브라우저에서 `http://localhost:8000` 접속

## GitHub Pages

이 저장소는 GitHub Actions 기반 Pages 배포 워크플로를 포함합니다.

- `master` 브랜치에 푸시하면 자동 배포
- 루트 정적 파일을 그대로 Pages 아티팩트로 업로드

배포가 처음이라면 GitHub 저장소의 `Settings > Pages`에서 source가 `GitHub Actions`로 표시되는지 확인하면 됩니다.

## Notes

- 공식 원본 리스트는 `database.js`의 `rawSources`를 기준으로 유지합니다.
- 삭제는 원본 파일을 직접 지우지 않고 로컬 오버레이(`deletedRestaurants`)로 반영됩니다.
- 카테고리 이동도 원본 DB를 직접 바꾸지 않고 로컬 수정값으로 저장됩니다.
