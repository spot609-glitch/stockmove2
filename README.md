# Stock Move Finder

개인 투자자를 위한 관심종목 급등락 감지 웹앱입니다. 최대 50개 관심종목을 등록하면
전일 종가 대비 설정한 기준(기본 ±4%) 이상 움직인 종목을 찾아 급등/급락 두 화면으로
보여주고, 각 종목을 클릭하면 핵심 원인과 근거 자료(공시/뉴스/커뮤니티 등)를 확인할
수 있습니다.

로그인/회원가입/서버 DB/결제/자동매매 기능은 없습니다. 관심종목과 기준값은
브라우저 **localStorage**에만 저장됩니다.

## 구조

```
web/         React + TypeScript 프론트엔드 (Vite)
server/src/  Express + TypeScript API (가격/공시/뉴스 조회 프록시)
  app.ts       cors+json+/api 라우터만 있는 순수 Express 앱 (정적 서빙, listen() 없음)
  index.ts     로컬/자체 호스팅용 진입점 — app.ts에 정적 파일 서빙과 listen() 추가
api/index.ts  Vercel Serverless Function 진입점 — app.ts를 그대로 export
```

백엔드가 필요한 이유: 종목 시세, DART 공시, 뉴스 검색 API는 브라우저에서 직접
호출 시 CORS로 막히거나 API 키가 노출되므로, 서버가 대신 호출해 프론트엔드에
전달합니다. 서버는 사용자 데이터를 저장하지 않는 단순 프록시입니다(DB 없음).

`app.ts`가 정적 파일 서빙/listen()과 분리되어 있는 이유는 Vercel 배포 때문입니다
(아래 "Vercel 배포" 참고).

## 로컬 실행

```bash
npm install    # workspaces(server, web) 의존성을 루트에서 한 번에 설치
npm run dev    # server(4000) + web(5173) 동시 실행
```

브라우저에서 http://localhost:5173 접속 (API 요청은 Vite 프록시를 통해 서버로 전달됩니다).

자체 서버(Render, Railway, VM 등)에 배포할 때는:

```bash
npm run build   # 프론트엔드(web/dist) + 서버(server/dist) 빌드
npm start        # server가 web/dist를 함께 서빙 (포트 4000, PORT 환경변수로 변경 가능)
```

## Vercel 배포

이 저장소에는 Vercel용 `vercel.json`이 포함되어 있습니다. Vercel에 이 저장소를
그대로 연결(Import)하면 별도 설정 없이 아래처럼 동작합니다.

- **정적 프론트엔드**: `npm run vercel-build`(=`web`만 빌드)로 만든 `web/dist`를
  Vercel이 CDN에서 정적으로 서빙합니다. Express는 여기에 관여하지 않습니다.
- **API**: `api/index.ts`가 Express 앱(`server/src/app.ts`)을 그대로 export하는
  Serverless Function입니다. `vercel.json`의 rewrite 규칙(`/api/(.*) → /api`)이
  `/api/search`, `/api/quotes`, `/api/analyze` 등 모든 하위 경로 요청을 이 함수로
  보내고, Express가 원래 경로(`req.url`)를 보고 알아서 라우팅합니다.
- **함수 실행 시간**: `/api/analyze`는 종목마다 공시·뉴스·커뮤니티를 순차/병렬로
  조회하고 선택적으로 AI 요약까지 호출하므로 수 초가 걸릴 수 있습니다.
  `vercel.json`에서 `maxDuration: 60`으로 설정해 두었지만, 플랜에 따라 실제
  허용 시간이 다를 수 있으니(Hobby/Pro 제한) 급등락 종목이 많을 경우 타임아웃이
  발생할 수 있습니다. 필요하면 플랜을 확인하거나 배치 크기를 줄여주세요.

**Vercel 프로젝트 설정 시 확인할 것**
- Framework Preset: "Other"(또는 자동 감지된 설정을 `vercel.json` 값으로 덮어써도 무방)
- Environment Variables: 아래 "환경변수" 표의 키를 Vercel 대시보드 → Settings →
  Environment Variables에 등록 (Production/Preview 모두)
- Root Directory: 저장소 루트 그대로 사용 (하위 폴더로 지정하지 않기)

## 환경변수 (선택)

`server/.env.example`를 `server/.env`로 복사해 설정하세요. **아무 것도 설정하지
않아도 앱은 정상 동작**하며, 가격 조회와 종목 검색은 즉시 사용할 수 있습니다.
다만 아래 키를 설정하면 원인 분석 품질이 크게 좋아집니다.

| 변수 | 설명 | 없을 때 동작 |
|---|---|---|
| `ANTHROPIC_API_KEY` | 검색된 자료를 근거로 핵심 원인(3단어 이내)·신뢰도·상세 설명을 자동 요약 | 원문 자료 목록만 표시하고 "직접 확인 필요"로 표기 (원인을 추측해서 만들어내지 않음) |
| `DART_API_KEY` | 종목별 최근 DART 공시 조회 | 공시 출처 없이 뉴스/커뮤니티만 조회 |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | 국내 뉴스·투자 카페(커뮤니티) 검색 품질 향상 | Google News RSS로 대체 |

무료 발급처:
- Anthropic API: https://console.anthropic.com/
- DART Open API: https://opendart.fss.or.kr/
- 네이버 검색 오픈API: https://developers.naver.com/apps/#/register

## 데이터 소스 & 정확성 원칙

- **가격/등락률**: 네이버 시세 공개 API(키 불필요)에서 현재가·전일종가를 가져와
  `(현재가 - 전일종가) / 전일종가 × 100` 공식으로 직접 계산합니다.
- **종목명/코드 검색**: KRX 상장법인 목록을 실시간으로 가져와 사용하고, 조회에
  실패하면 저장된 주요 종목 시드 목록(`server/src/data/krxSeed.json`)으로
  대체합니다.
- **원인 조사**: 공시(DART) → 회사 발표 → 국내/해외 주요 뉴스 → 산업 뉴스 →
  커뮤니티(네이버 카페) → SNS(Reddit) 순으로 실제 검색된 자료만 근거로 사용합니다.
  AI 요약은 검색된 자료에 없는 내용을 추측하지 않도록 프롬프트로 강제되어 있으며,
  뚜렷한 원인이 확인되지 않으면 항상 **"특이사항 없음"**으로 표시합니다.
  커뮤니티/SNS 기반 정보는 상세 화면에서 반드시 **"시장 추정"** 또는
  **"미확인 정보"**로 별도 표기됩니다.

## 알려진 제한사항

- 경쟁사 뉴스·공급망 뉴스는 종목별 산업/경쟁사 매핑 데이터가 없어 별도
  전용 검색을 수행하지 않습니다. AI 요약 사용 시, 수집된 뉴스 안에서 경쟁사·
  공급망 관련 내용이 확인되면 상세 설명에 자연스럽게 포함됩니다.
- 해외 SNS(X/Twitter 등)는 무료 공개 API가 사실상 없어 Reddit 검색으로
  대체했습니다. 결과가 없을 수 있습니다.
- KRX 상장목록 실시간 조회, 네이버 시세 조회, 뉴스 검색은 모두 외부 네트워크
  호출이 필요합니다. 이 저장소를 만든 개발 환경(Claude Code 샌드박스)은 외부
  네트워크가 정책상 차단되어 있어 실제 배포 환경(일반 서버/호스팅)에서 다시
  한 번 연결을 확인해 보시길 권장합니다. 모든 외부 호출은 실패 시 앱이
  죽지 않고 종목별로 에러를 표시하도록 처리되어 있습니다.

## 주요 화면

- 상단: 타이틀, 관심종목 개수(N/50), 관심종목 편집, 기준 변동률 선택(3/4/5/7%,
  기본 4%), "관심종목 분석" 버튼(핵심 실행 버튼 1개)
- 좌/우: 🔺 급등 종목 / 🔻 급락 종목 (종목명 · 등락률 · 3단어 이내 핵심 원인)
- 종목 클릭 시 상세 패널: 핵심 원인, 신뢰도(높음/보통/낮음), 2~4문장 설명,
  출처별 근거 목록(원문 링크 포함)
