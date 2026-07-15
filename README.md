# World Weather Atlas

전 세계 도시와 지도 좌표를 기준으로 현재 날씨, 48시간 예보, 주간 예보, 과거 날씨를 확인하는 반응형 웹 애플리케이션입니다.

## Live Demo

- https://wakbu.github.io/world-weather-atlas/

## 주요 기능

- 도시명 검색과 검색 후보 선택
- 브라우저 현재 위치 조회
- Leaflet 지도 클릭 및 핀 드래그를 통한 위치 선택
- 현재 기온, 체감온도, 습도, 강수량, 풍속, 기압, 구름량 표시
- 10분 간격 자동 갱신과 수동 새로고침
- 현재 기상 코드와 실시간 강수량으로 비를 확인할 때만 표시되는 RainViewer 비구름 레이더
- 예보 임계값으로 계산한 호우·뇌우·폭염·한파·강풍·대기질 위험 신호
- 앞으로 24시간 시간별 강수 타임라인과 출퇴근·운동·세탁·우산·자외선 적합도
- 일출·일몰 진행도, 낮 길이, 달 위상 정보
- 실시간·캐시 여부와 API별 제공 상태를 보여주는 데이터 신뢰도
- 위치별 비·눈·폭염·미세먼지 알림 조건 저장
- 색각 친화 팔레트, 키보드 탭 탐색, 모션 감소 접근성 설정
- 강수, 자외선, 기온, 바람에 따른 생활 조언과 12시간 이내 강수 알림
- Open-Meteo 기반 AQI, PM2.5, PM10, 오존, 이산화질소 대기질 정보
- 즐겨찾기, 최근 위치, 최대 3개 도시 날씨 비교
- 선택 위치와 탭을 유지하는 공유 URL
- URL 매개변수가 없을 때 서울로 시작하며 저장 위치·설정까지 지우는 2단계 초기화
- 비구름 레이더, 8×6 표본을 보간한 구름량·PM2.5 연속 히트맵, 고대비 풍향·풍속 표시를 전환하는 기상 지도
- 마지막 정상 날씨 로컬 캐시와 API별 오류 상태
- 풍속, 강수량, 기압 단위 설정과 한국어/영어 전환
- PWA 설치와 오프라인 앱 화면
- 기상 지도 이동 시 현재 화면 영역의 최신 모델 격자 자동 재조회
- 48시간 기온 변화와 강수확률 그래프
- 향후 7일 최고·최저 기온 및 강수량 그래프
- 최대 31일 범위의 과거 날씨 조회
- 섭씨/화씨 전환
- 라이트/다크 모드 및 설정 저장
- 데스크톱, 태블릿, 모바일 반응형 레이아웃과 모바일 전용 2열 탭·지도 레이어 메뉴

## 기술 스택

- HTML5
- CSS3
- Vanilla JavaScript
- Leaflet 1.9.4
- OpenStreetMap
- GitHub Pages / GitHub Actions

## 사용 API

| 용도 | API |
| --- | --- |
| 도시 검색 | Open-Meteo Geocoding API |
| 현재 날씨 및 예보 | Open-Meteo Forecast API |
| 과거 날씨 | Open-Meteo Historical Weather API |
| 대기질 | Open-Meteo Air Quality API / CAMS ENSEMBLE |
| 비구름 레이더 | RainViewer Weather Maps API |
| 지도 타일 | OpenStreetMap |

Open-Meteo는 이 프로젝트에서 API 키 없이 브라우저에서 직접 호출합니다.

## 로컬 실행

별도의 빌드 과정이나 패키지 설치가 필요하지 않습니다. `index.html`을 브라우저에서 열거나 정적 파일 서버를 사용합니다.

```powershell
npx serve .
```

지도와 날씨 API 호출을 위해 인터넷 연결이 필요합니다.

## 프로젝트 구조

```text
.
├── index.html
├── styles.css
├── script.js
├── manifest.webmanifest
├── service-worker.js
├── assets/
├── docs/
│   └── PROGRAM_GUIDE.md
└── .github/workflows/pages.yml
```

## 배포

`main` 브랜치가 GitHub에 푸시되면 `.github/workflows/pages.yml`이 정적 파일을 GitHub Pages에 자동 배포합니다.

## 참고

- 과거 날씨는 한 번에 최대 31일까지 조회하도록 제한했습니다.
- 날씨 캐시는 브라우저에 최대 7일간 보관되며 최신 데이터가 아닐 때 저장 시각을 표시합니다.
- 강수 알림은 브라우저가 열려 있고 알림 권한이 허용된 환경에서 동작합니다.
- OpenStreetMap 지도 사용 시 화면에 표시되는 저작자 표시를 유지해야 합니다.
- 날씨 데이터의 제공 시점과 정확도는 Open-Meteo 데이터셋에 따릅니다.
- RainViewer 레이더는 현재 비가 확인될 때만 요청하며 서비스 제공 범위에 따라 일부 지역은 표시되지 않을 수 있습니다.

자세한 구조와 동작 방식은 [프로그램 설명서](docs/PROGRAM_GUIDE.md)를 참고하세요.
