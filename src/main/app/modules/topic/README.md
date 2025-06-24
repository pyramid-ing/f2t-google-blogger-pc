# Topic 모듈

SEO 최적화된 블로그 제목 생성 및 관리 모듈입니다.

## 📋 기능 개요

### 🎯 Topic 모듈 (API 중심)
- **주제 기반 제목 생성**: AI를 활용한 SEO 최적화된 제목 생성
- **엑셀 내보내기**: 생성된 제목들을 엑셀 파일로 다운로드
- **제목 관리**: 생성된 제목들의 조회 및 관리

### 🔄 Workflow 모듈 (백그라운드 자동화)
- **자동 스케줄링**: 매일 오전 9시 자동 제목 생성
- **수동 실행**: 필요 시 수동으로 워크플로우 실행
- **상태 관리**: 워크플로우 실행 상태 및 다음 실행 시간 확인

## 🛠 API 엔드포인트

### Topic API

#### 1. SEO 제목 생성
```
GET /topic/find?topic={주제}&limit={개수}
```
- **설명**: 사용자가 요청한 주제에 대해 SEO 최적화된 제목들을 생성
- **파라미터**:
  - `topic` (필수): 기본 주제 (예: "소상공인", "정부지원금")
  - `limit` (선택, 기본값: 5): 생성할 제목 개수
- **응답**: Topic 배열

**예시 요청:**
```bash
GET /topic/find?topic=소상공인&limit=3
```

#### 2. 엑셀 다운로드
```
GET /topic/export
```
- **설명**: 모든 생성된 제목들을 엑셀 파일로 내보내기
- **응답**: Excel 파일 다운로드

#### 3. 모든 제목 조회
```
GET /topic/list
```
- **설명**: 데이터베이스에 저장된 모든 제목 조회
- **응답**: Topic 배열

#### 4. 기본 주제별 조회
```
GET /topic/list/:baseTopic
```
- **설명**: 특정 기본 주제로 생성된 제목들만 조회
- **파라미터**: `baseTopic` - 기본 주제명
- **응답**: Topic 배열

### Workflow API

#### 1. 수동 워크플로우 실행
```
POST /workflow/topic/run
```
- **설명**: 주제 생성 워크플로우를 수동으로 실행
- **요청 바디** (선택):
```json
{
  "topics": ["소상공인", "정부지원금", "대출"]
}
```
- **응답**:
```json
{
  "message": "주제 생성 워크플로우가 성공적으로 실행되었습니다.",
  "success": true
}
```

#### 2. 워크플로우 상태 확인
```
GET /workflow/status
```
- **설명**: 자동 워크플로우의 현재 상태와 다음 실행 시간 확인
- **응답**:
```json
{
  "nextRun": "2024/12/24 오전 9:00:00",
  "isActive": true,
  "baseTopics": ["소상공인", "정부지원금", "대출", "보험"]
}
```

## 📊 데이터 모델

### Topic Entity
```typescript
interface Topic {
  id: number;           // 고유 ID
  baseTopic: string;    // 기본 주제 (소상공인, 정부지원금 등)
  title: string;        // SEO 최적화된 제목
  content?: string;     // 제목에 대한 간단한 설명
  isAuto: boolean;      // 자동 생성 여부
  createdAt: Date;      // 생성일
  updatedAt: Date;      // 수정일
}
```

## 🤖 AI 프롬프트 

현재 시스템에서 사용하는 AI 프롬프트:

```
사용자가 구글과 네이버에서 상위노출을 목표로 블로그 글을 작성할 수 있도록 돕는 것입니다.

**제목 최적화 지원**
- 사용자가 제시한 대략적인 제목을 기반으로 SEO를 고려한 최적화된 제목 N가지를 제안
- 검색 의도를 반영하며, 메인 키워드를 자연스럽게 포함
- 제목 길이는 모바일 환경에 적합한 20자 미만 유지
```

## ⏰ 자동 스케줄링

- **실행 시간**: 매일 오전 9시 (Cron: `0 9 * * *`)
- **기본 주제**: 
  - 소상공인
  - 정부지원금  
  - 대출
  - 보험
- **생성 개수**: 각 주제당 3개씩
- **API 레이트 리미트**: 각 주제별 1초 간격으로 처리

## 🔧 설정 및 확장

### n8n AI Agent 연동
현재는 시뮬레이션 데이터를 반환하지만, 실제 n8n AI Agent와 연동하려면 `TopicService.callN8nAiAgent` 메서드에서 HTTP 요청을 구현하세요:

```typescript
private async callN8nAiAgent(topic: string, limit: number) {
  const response = await fetch('YOUR_N8N_WEBHOOK_URL', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, limit, prompt })
  });
  return await response.json();
}
```

### 커스텀 주제 추가
`TopicWorkflow.runDailyTopicPrompt` 메서드에서 `baseTopics` 배열을 수정하여 자동 생성할 주제를 변경할 수 있습니다.

## 🚀 사용 예시

1. **수동 제목 생성**:
   ```bash
   curl "http://localhost:3000/topic/find?topic=소상공인&limit=5"
   ```

2. **자동 워크플로우 수동 실행**:
   ```bash
   curl -X POST "http://localhost:3000/workflow/topic/run" \
     -H "Content-Type: application/json" \
     -d '{"topics": ["소상공인", "대출"]}'
   ```

3. **엑셀 다운로드**:
   ```bash
   curl "http://localhost:3000/topic/export" -o seo-topics.xlsx
   ```

## 📁 파일 구조

```
src/main/app/modules/
├── topic/
│   ├── topic.entity.ts      # 데이터 모델 정의
│   ├── topic.service.ts     # 비즈니스 로직
│   ├── topic.controller.ts  # API 엔드포인트
│   ├── topic.module.ts      # 모듈 설정
│   └── README.md           # 이 파일
│
└── workflow/
    ├── topic.workflow.ts     # 주제 생성 워크플로우
    ├── workflow.controller.ts # 워크플로우 제어 API
    └── workflow.module.ts    # 워크플로우 모듈
``` 