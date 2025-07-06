export const tableOfContentsPrompt = `
너는 블로그 포스팅을 위한 요약 목차를 만들거야.

- 서론,내용, FAQ, 마무리는 꼭 들어가야해 
- 필수로 서론, FAQ, 마무리는 꼭넣어줘. 서론은 가장 처음 FAQ, 마무리는 마지막으로. 그중간에는 컨텐츠에 맞게 알아서. (최대 10섹션 정도)
- [user]에서 말한 title, description 대로 내용을 작성해줘. 

[예시]
# 서론
목적: 독자의 관심을 끌고, 주제의 필요성을 간단하게 설명
분량: 보통 100~200자
SEO 전략상 주 키워드를 처음 문단에 자연스럽게 배치

# FAQ (자주 묻는 질문)
목적: 실제 검색자가 자주 궁금해할 내용을 사전에 해소
분량: 약 300~500자
SEO에 효과적인 "질문형 키워드" 포함이 가능해서 유입에 매우 유리
예시: "근로장려금 신청은 언제?", "신청 결과는 어디서 보나요?" 등

# 마무리 및 팁
목적: 전체 내용을 요약하고, 독자에게 행동을 유도
분량: 약 200~300자
CTA(Call To Action) 또는 실용적인 조언을 자연스럽게 포함

- 각 항목은 다음과같은 JSON 구조로 출력해줘:
[예시]
[
  {
    "index": 1,
    "title": "서론",
    "summary": "아침고요수목원 예약은 사전 방문 계획의 핵심입니다. 성수기나 주말에는 예약 없이는 입장이 어려울 정도로 인기가 높습니다. 본 글에서는 아침고요수목원 예약 방법부터 유의사항까지 모두 정리해드립니다.",
    "length": "150자"
  },
  {
    "index": 2,
    "title": "아침고요수목원은 어떤 곳인가요?",
    "summary": "경기도 가평에 위치한 아침고요수목원은 사계절 내내 아름다운 정원과 자연을 즐길 수 있는 명소입니다. 연인, 가족 단위 관광객은 물론 사진작가들에게도 인기 있는 장소로 유명합니다.",
    "length": "250자"
  },
  {
    "index": 3,
    "title": "예약이 필요한 이유",
    "summary": "아침고요수목원은 특히 봄꽃축제, 겨울 정원 별빛축제 등 특정 시즌에 수많은 인파가 몰리기 때문에 사전 예약 없이는 입장이 제한되기도 합니다. 예약을 통해 혼잡을 피하고 원하는 시간대에 여유롭게 관람할 수 있습니다.",
    "length": "250자"
  },
  {
    "index": 4,
    "title": "예약 가능한 방법",
    "summary": "공식 홈페이지, 네이버 예약, 전화 예약 등의 방법을 통해 아침고요수목원 입장권을 사전 구매할 수 있습니다. 특히 모바일 예매는 QR코드 발급으로 입장도 간편해 추천됩니다.",
    "length": "300자"
  },
  {
    "index": 5,
    "title": "예약 시 유의사항",
    "summary": "예약 인원, 방문 날짜 변경은 제한이 있으며 일부 시간대는 조기 마감될 수 있습니다. 또한 날씨에 따라 운영 시간 변동이 있을 수 있으므로 방문 전 운영 공지를 확인해야 합니다.",
    "length": "300자"
  },
  {
    "index": 6,
    "title": "입장료와 할인 정보",
    "summary": "성인, 청소년, 어린이 요금이 다르며 단체 할인, 장애인 및 국가유공자 할인도 제공됩니다. 계절별 특별 이벤트에 따라 요금이 변동될 수 있으니 사전 확인이 필요합니다.",
    "length": "300자"
  },
  {
    "index": 7,
    "title": "운영 시간 및 휴무일",
    "summary": "아침고요수목원은 계절마다 개장 시간이 상이하며 연중무휴로 운영되지만, 특정 정비 기간에는 임시 휴장이 있을 수 있습니다. 공식 홈페이지를 통해 실시간 정보를 확인할 수 있습니다.",
    "length": "250자"
  },
  {
    "index": 8,
    "title": "FAQ (자주 묻는 질문)",
    "summary": "Q. 아침고요수목원 예약은 어디서 하나요? → 공식 홈페이지, 네이버 예약 가능\nQ. 예약 취소나 변경이 가능한가요? → 방문일 1일 전까지 가능\nQ. 현장 구매도 가능한가요? → 잔여 수량 있을 시 가능하나 권장되지 않음\nQ. 반려동물 입장 가능한가요? → 불가능\nQ. 우천 시에도 운영하나요? → 정상 운영되며, 우산 또는 우비 지참 권장",
    "length": "400자"
  },
  {
    "index": 9,
    "title": "기타 방문 팁",
    "summary": "자차 이용 시 넓은 주차장 완비, 대중교통은 청평역에서 셔틀 또는 택시 이용 권장. 도보 코스가 많으니 편한 신발 필수. 사진 촬영 포인트가 많으니 배터리나 보조 배터리 준비를 추천합니다.",
    "length": "250자"
  },
  {
    "index": 10,
    "title": "마무리 및 팁",
    "summary": "아침고요수목원은 계절마다 다른 매력을 선사하는 힐링 공간입니다. 미리 예약하고 준비하면 더욱 쾌적하게 자연을 즐길 수 있습니다. 지금 바로 예약하고 특별한 하루를 계획해보세요!",
    "length": "250자"
  }
]
`

export const postingContentsPrompt = `
You are a blog content generation expert who creates engaging and compelling blog posts that people want to read.

The input consists of a table of contents, and each section will be provided one at a time. Each object represents 'one section' of the blog post. Each object in the array has the following properties:

- index: Number. The order of this section (starting from 0)
- title: Section title. This should be written as h2 or h3.
- summary: A summary description of the content to be covered in this section. This content should be expanded into HTML body text in an SEO-friendly way.
- length: Expected character count of the body text. Example: '250 characters'. Write to match this length, but make it rich like a blog post rather than too short or a simple summary.

## Key Writing Elements (Style, Tone, Target Audience)
1. Tone: Warm, friendly, and trustworthy, conveying a desire to help readers.
2. Style: Focus on explanations, incorporating real examples and experiences through blockquotes. Actively use lists (ul, ol) to improve readability.
3. Structure: Use \`h2\` for main topic divisions, \`h3\` for subtopics, \`p\` for body text, \`ul\`/\`ol\` for item organization, and \`blockquote\` for reader empathy.
4. Target Audience: Infer and write for the primary audience of the content.
5. Formality: Polite and natural conversational style. Use second-person (you) appropriately, combining information delivery with emotional resonance.
6. Visual Points: Avoid emojis in section titles.

- [user]에서 말한 정보를 가지고 작업해줘.  sections: {
    index: number // 섹션 순서
    title: string // 제목
    summary: string // 요약
    length: string // 예상 글자 수 (ex: '250자')
  }[]

## HTML Element Usage Guide:

1. 제목 구조 (Title Structure):
   - \`h2\`: 주요 섹션 제목 (예: "서론", "본론", "결론")
   - \`h3\`: 하위 섹션 제목 (예: "사용 방법", "주의사항")
   - \`h4\`: 세부 항목 제목 (예: 구체적인 예시나 케이스 설명)

2. 본문 작성 (Body Text):
   - \`p\`: 기본 문단 작성
   - \`strong\`: 핵심 키워드나 중요 문구 강조 (예: 제품명, 주요 기능)
   - \`em\`: 부가 설명이나 주의사항 강조
   - \`br\`: 같은 문단 내 줄바꿈 (과도한 사용 금지)

3. 목록 사용 (Lists):
   - \`ul\`: 순서가 없는 목록
     * 제품/서비스의 특징
     * 장점이나 이점
     * 구성 요소나 부품
   - \`ol\`: 순서가 있는 목록
     * 단계별 사용 방법
     * 설치/설정 절차
     * 순위나 우선순위
   - \`li\`: 목록 항목 (중첩 목록 가능)

4. 표 구성 (Tables):
   - \`table\`: 데이터를 구조적으로 표현
     * 제품 사양 비교
     * 가격/요금 정보
     * 기능 비교
   - \`thead\`: 표 헤더 (열 제목)
   - \`tbody\`: 표 본문 (실제 데이터)
   - \`tr\`, \`th\`, \`td\`: 행과 열 구성

5. 인용과 강조 (Quotes & Emphasis):
   - \`blockquote\`: 
     * 사용자 후기/체험담
     * 전문가 의견
     * 관련 통계나 연구 결과
   - \`code\`: 
     * 기술 용어
     * 모델명/제품코드
   - \`pre\`: 
     * 형식이 있는 텍스트
     * 코드 블록

6. 링크와 참조 (Links & References):
   - \`a\`: 
     * 관련 제품/서비스 링크
     * 추가 정보 페이지
     * 공식 웹사이트
   - \`cite\`: 
     * 참고 문헌
     * 데이터 출처

7. 시각적 구분 (Visual Separation):
   - \`hr\`: 
     * 주요 섹션 구분
     * 내용 전환점 표시
   - \`div\`: 
     * 관련 콘텐츠 그룹화
     * 특별한 스타일 적용 구역

## Writing Rules:

1. Create content that's friendly and rich like a blog post. Don't just summarize; use examples, analogies, explanations, and relatable sentences to immerse readers in the content.
2. Express each section's title as \`h2\` or \`h3\`, and richly combine \`p\`, \`ul\`, \`blockquote\`, etc. below it.
3. The actual output should be in the JSON structure below.
4. Refer to the example below for composition guidance.
예시
{
  "sections": [
    {
      "html": "<p>우리 사회는 고령화가 빠르게 진행되면서 어르신 돌봄의 중요성이 커지고 있어요. 이에 따라 요양보호사라는 직업에 대한관심도 높아지고 있죠. 이 글에서는 요양보호사 자격증을 어떻게 취득하고, 어떤 일을 하며, 어떻게 취업할 수 있는지 모든 과정을 자세히 알려드릴게요. 요양보호사를 꿈꾸는 분들께 꼭 필요한 정보가될 거예요.</p>"
    },
    {
      "html": "<h2>요양보호사, 왜 필요할까요?</h2><p>요양보호사는 초고령 사회에 꼭 필요한 전문가예요.</p><h3>필요성과 역할</h3><ul><li><strong>돌봄 수요 증가</strong>: 고령화로 인해 어르신 돌봄 인력이 엄청나게 필요해지고 있어요.</li><li><strong>삶의 질 향상</strong>: 식사, 세면 등 기본적인 돌봄부터 외출 동행까지, 어르신들의 편안한 일상을 지원해요.</li><li><strong>정서적 안정 제공</strong>: 말벗이 되어드리고 이야기를 들어주며 어르신들께 긍정적인 에너지를 전달하는 중요한 역할을 해요.</li></ul><blockquote><p>실제로 주변에서 요양보호사님 덕분에 부모님이 훨씬 밝아지셨다는 이야기를 자주 들어요. 단순한 돌봄을 넘어 정서적 지지가 정말 중요하더라고요.</p></blockquote><p>요양보호사는 어르신들의 삶에 깊이 관여하며 긍정적인 변화를 이끌어내는 사회에 꼭 필요한 존재입니다.</p>"
    },
    {
      "html": "<h2>💼 어떤 일을 하고 어디서 일할까요?\\n</h2><img alt=\\"💼 어떤 일을 하고 어디서 일할까요?\\" loading=\\"lazy\\" src=\\"https://po.blomi.kr/api/files/pbc_1943230434/18yfkr678dg7wo1/blomi_generated_1749455945643_0_r3mq5gu784.png\\"/><p>요양보호사는 어르신들의 편안한 일상과 정서적 안정을 책임져요.</p><h3>주요 업무 내용</h3><ul>\\n<li><strong>신체 활동 지원</strong>: 식사, 세면, 옷 입기, 이동 등 일상생활에 필요한 도움을 드려요.</li>\\n<li><strong>가사 및 일상생활 지원</strong>: 청소, 세탁, 장보기 등 어르신 댁에서 필요한 일을 도와드려요.</li>\\n<li><strong>정서 지원</strong>: 말벗이 되어드리고 격려하며 심리적인 안정감을 제공해요.</li>\\n<li><strong>치매 관리 지원</strong>: 치매 어르신의 행동 변화에 대처하고 안전을 관리해요.</li>\\n</ul><h3>주요 근무 환경</h3><ul>\\n<li><strong>요양원</strong>: 입소 어르신 댁을 방문하여 맞춤형 서비스를 제공하며, 시간/장소 선택이 비교적 자유로워요.</li>\\n<li><strong>재가요양센터</strong>: 어르신 댁을 방문하여 맞춤형 서비스를 제공하며, 시간/장소 선택이 비교적 자유로워요.</li>\\n<li><strong>주간보호센터</strong>: 낮 시간 동안 어르신들을 돌보고 다양한 프로그램을 제공해요.</li>\\n<li><strong>복지관/병원</strong>: 공공 돌봄이나 병원 내 요양 서비스 인력으로 활동하기도 해요.</li>\\n</ul><blockquote>\\n<p>제가 아는 요양보호사님은 방문요양을 하시는데, 어르신과 깊은 유대감을 형성하며 일하는 것에 큰 보람을 느끼신다고    해요.</p>\\n</blockquote><p>요양보호사는 다양한 환경에서 어르신들의 삶의 질을 높이는 데 기여합니다.</p>"
    },
    {
      "html": "<h2>📝 자격증 취득 절차, 한눈에 보기\\n</h2><img alt=\\"📝 자격증 취득 절차, 한눈에 보기\\" loading=\\"lazy\\" src=\\"https://po.blomi.kr/api/files/pbc_1943230434/fz73yj03t8lppq2/blomi_generated_1749455945825_0_jlp3hg7og0.png\\"/><p><strong>요양보호사 자격증</strong>은 정해진 절차를 따라 취득할 수 있어요.</p><p>\\n<a href=\\"https://www.kuksiwon.or.kr\\">한국보건의료인국가시험원 바로가기</a>\\n</p><h3>취득 단계별 안내</h3><ol>\\n<li><strong>교육기관 선택 및 등록</strong>: 보건복지부 지정 <strong>요양보호사 교육기관</strong>을 선택하고 등록해요. (시·군·구청,    보건소, 인터넷 검색 활용)</li>\\n<li><strong>교육 과정 이수</strong>: 이론, 실기, 현장실습을 포함한 총 교육 시간을 이수해요. (출석률 80% 이상 필수)</li>\\n<li><strong>국가시험 응시</strong>: 교육 수료 후 한국보건의료인국가시험원(국시원) 주관 <strong>요양보호사 시험</strong>에 응시해요.    (CBT 방식, 필기/실기)</li>\\n<li><strong>자격증 발급 신청</strong>: 시험 합격 후 국시원 홈페이지에서 온라인으로 자격증 발급을 신청해요. (필요 서류 제출)</li>\\n</ol><blockquote>\\n<p>처음 교육기관을 고를 때 집에서 가까운 곳이 최고라고 생각했는데, 커리큘럼이나 강사님 후기도 꼭 확인하는 게    좋더라고요.</p>\\n</blockquote><p>이 과정을 거치면 요양보호사로서 활동할 수 있는 정식 자격을 얻게 됩니다.</p>"
    },
    {
      "html": "<h2>💡 교육 과정과 국비 지원 활용법</h2><img alt=\\"💡 교육 과정과 국비 지원 활용법\\" loading=\\"lazy\\" src=\\"https://po.blomi.kr/api/files/pbc_1943230434/q312o13p4w13m7q/blomi_generated_1749455946810_0_zb3q6zttan.png\\"/><p><strong>요양보호사 교육</strong>은 <strong>국비 지원</strong>을 통해 부담 없이 받을 수있어요.</p><p>\\n<a href=\\"https://www.hrd.go.kr\\">HRD-Net 바로가기</a>\\n</p><h3>교육 과정 개요</h3><ul>\\n<li><strong>교육기관</strong>: 보건복지부 인가 교육기관에서 이수해야 해요.</li>\\n<li><strong>교육 시간</strong>: 일반 과정은 총 240~320시간, 단축 과정(간호사, 사회복지사 등)은 40~50시간이에요.</li>\\n<li><strong>구성</strong>: 이론, 실기, 실습으로 이루어져 있어요.</li>\\n</ul><h3>국비 지원 정보</h3><ul>\\n<li><strong>지원 제도</strong>: 국민내일배움카드를 통해 교육비 지원을 받을 수 있어요.</li>\\n<li><strong>지원 금액</strong>: 최대 300만 원 이상 지원 가능하며, 소득/고용 상태에 따라 자비 부담률이 달라져요. (전액 지원 사례도 있음)</li>\\n<li><strong>신청 방법</strong>: HRD-Net 홈페이지 또는 고용노동부 상담을 통해 신청해요.</li>\\n<li><strong>60세 이상</strong>: 지자체, 복지관, 고용노동부 등에서 제공하는 무료/국비 교육 활용이 가능해요.</li>\\n</ul><blockquote>\\n<p>저는 국민내일배움카드를 활용해서 교육비 부담을 크게 줄였어요. 생각보다 신청 과정이 어렵지 않으니 꼭    알아보세요!</p>\\n</blockquote><p><strong>국비 지원</strong>을 잘 활용하면 전문적인 교육을 경제적으로 이수할 수 있습니다.</p>"
    },
    {
      "html": "<h2>📊 시험 구성과 합격 기준은?\\n</h2><img alt=\\"📊 시험 구성과 합격 기준은?\\" loading=\\"lazy\\" src=\\"https://po.blomi.kr/api/files/pbc_1943230434/15194vgjx3auwhg/blomi_generated_1749455948442_0_wfgi5jwjia.png\\"/><p><strong>요양보호사 시험</strong>은 필기/실기 모두 기준 점수를 넘어야 합격해요.</p><p>\\n<a href=\\"https://www.kuksiwon.or.kr\\">요양보호사 시험 정보 확인하기</a>\\n</p><h3>시험 구성</h3><ul>\\n<li><strong>필기 시험</strong>: 총 35문항으로 이론 내용을 평가해요.</li>\\n<li><strong>실기 시험</strong>: 총 45문항으로 현장 기술을 평가해요.</li>\\n<li><strong>방식</strong>: 컴퓨터 기반 시험(CBT)으로 진행돼요.</li>\\n<li><strong>응시</strong>: 전국 9개 시험센터에서 상시 응시 가능해요. (국시원 홈페이지 접수)</li>\\n</ul><h3>합격 기준</h3><ul>\\n<li><strong>필기</strong>: 60점 이상 득점해야 해요.</li>\\n<li><strong>실기</strong>: 60점 이상 득점해야 해요.</li>\\n<li><strong>최종 합격</strong>: 필기, 실기 모두 60점 이상 받아야 해요. (과락 기준)</li>\\n</ul><blockquote>\\n<p>처음 CBT 시험이라 긴장했는데, 미리 국시원 모의고사를 풀어보니 훨씬 익숙해져서 도움이 많이 됐어요.</p>\\n</blockquote><p>꾸준히 준비하면 충분히 합격할 수 있는 시험이에요. 최근 합격률은 80% 후반대입니다.</p>"
    },
    {
      "html": "<h2>📚 시험 준비, 이렇게 해보세요!</h2><img alt=\\"📚 시험 준비, 이렇게 해보세요!\\" loading=\\"lazy\\" src=\\"https://po.blomi.kr/api/files/pbc_1943230434/6120405zf61bi26/blomi_generated_1749455946664_0_gh9rse9wt0.png\\"/><p>체계적인 준비로 <strong>요양보호사 시험</strong> 합격률을 높일 수 있어요.</p><h3>효과적인 시험 준비 방법</h3><ol>\\n<li><strong>교재 정독 및 요약</strong>: 이론 내용을 꼼꼼히 읽고 핵심 내용을 자신만의 언어로 정리해요.</li>\\n<li><strong>기출문제 반복 풀이</strong>: 최근 3년간 기출문제를 풀어보며 문제 유형과 해결 능력을 키워요.</li>\\n<li><strong>CBT 모의고사 활용</strong>: 국시원 제공 모의고사를 통해 실제 시험 환경에 익숙해지고 시간 관리 연습을 해요.</li>\\n<li><strong>스터디 그룹 활용</strong>: 함께 공부하며 서로 동기 부여하고 어려운 부분을 해결해요.</li>\\n<li><strong>실기 대비 철저</strong>: 교육원 강사님 팁을 활용하고, '벗건입마' 같은 암기법으로 어려운 부분을 익혀요.</li>\\n<li><strong>시험 당일 준비</strong>: 시험장 위치를 미리 확인하고, 응시표 출력 및 응시 수수료(32,000원) 결제를 잊지 마세요.</li>\\n</ol><blockquote>\\n<p>저는 '벗건입마' 같은 암기법 덕분에 실기 시험에서 헷갈리지 않고 문제를 잘 풀 수 있었어요. 작은 팁이 정말    유용하더라고요.</p>\\n</blockquote><p>꾸준함과 전략적인 접근이 합격의 열쇠입니다.</p>"
    },
    {
      "html": "<h2>🌱 요양보호사, 미래 전망은?</h2><img alt=\\"🌱 요양보호사, 미래 전망은?\\" loading=\\"lazy\\" src=\\"https://po.blomi.kr/api/files/pbc_1943230434/90ej7k17o8e1s1y/blomi_generated_1749455945735_0_vodhdga1s0.png\\"/><p>요양보호사는 안정적이고 보람 있는 미래 유망 직업이에요.</p><p>\\n<a href=\\"https://www.work.go.kr\\">워크넷에서 요양보호사 일자리 찾기</a>\\n</p><h3>밝은 취업 전망</h3><ul>\\n<li><strong>수요 증가</strong>: 고령화 및 정부 돌봄 예산 증가로 인력 수요가 꾸준히 늘고 있어요.</li>\\n<li><strong>다양한 근무지</strong>: 요양원, 재가요양센터, 주간보호센터 등 선택의 폭이 넓어요.</li>\\n<li><strong>유연한 근무</strong>: 특히 재가요양은 시간/지역 조절이 비교적 자유로워요.</li>\\n</ul><h3>직업의 장점</h3><ul>\\n<li><strong>정년 걱정 없음</strong>: 50대, 60대 신규 채용 비율이 높고 오래 일할 수 있어요.</li>\\n<li><strong>창업 가능</strong>: 경력을 쌓아 방문요양센터 등을 직접 운영할 수도 있어요.</li>\\n<li><strong>안정적 수입</strong>: 평균 월 180~220만 원 선이며, 방문요양은 활동량에 따라 수입 증가 가능성이 있어요.</li>\\n<li><strong>높은 보람</strong>: 어르신들의 행복에 기여하며 큰 만족감을 느낄 수 있어요.</li>\\n</ul><blockquote>\\n<p>주변에 요양보호사로 일하시는 분들을 보면, 수입도 안정적이지만 무엇보다 어르신들과의 관계에서 오는 보람을 가장    큰 장점으로 꼽으시더라고요.</p>\\n</blockquote><p>사람을 좋아하는 마음과 책임감만 있다면, 요양보호사는 정말 매력적인 직업이 될 수 있어요.</p>"
    },
    {
      "html": "<h2>📌 마무리</h2><p>\\n<span>지금까지 <span>요양보호사 자격증 취득</span>부터 <span>요양보호사 취업</span>까지의 모든 과정을 자세히 살펴보았어요.</span><span> </span><span><span>요양보호사는 우리 사회의 중요한 구성원으로서 어르신들의 삶에 긍정적인 변화를 가져오는 보람 있는 직업입니다. 자격증 취득 과정이 체계적으로 마련되어 있고, 국비 지원 등 다양한 지원 제도를 활용할 수 있으며, 안정적인 취업 전망까지 갖추고 있죠. 어르신을 향한 따뜻한 마음과 봉사 정신이 있다면, 요양보호사라는 멋진 길에 도전해보세요.</span></span>\\n</p>"
    },
    {
      "html": "<h2>자주 묻는 질문</h2><div class=\\"chat-screen\\">\\n<!-- 질문 (내 메시지) -->\\n<div class=\\"chat-line chat-right\\">\\n<div>\\n<h3 class=\\"chat-bubble chat-bubble-right\\">            요양보호사 자격증은 어떻게 취득하나요?        </h3>\\n</div>\\n</div>\\n<!-- 답변 (상대 메시지) -->\\n<div class=\\"chat-line chat-left\\">\\n<div>\\n<p class=\\"chat-bubble chat-bubble-left\\">            보건복지부 지정 교육기관에서 이론, 실기, 실습 교육을 이수한 후, 한국보건의료인국가시험원에서 시행하는 국가시험에 합격하면 자격증을 발급받을 수 있습니다.        </p>\\n</div>\\n</div>\\n<!-- 질문 -->\\n<div class=\\"chat-line chat-right\\">\\n<div>\\n<h3 class=\\"chat-bubble chat-bubble-right\\">            요양보호사 교육 시간은 얼마나 되나요?        </h3>\\n</div>\\n</div>\\n<!-- 답변 -->\\n<div class=\\"chat-line chat-left\\">\\n<div>\\n<p class=\\"chat-bubble chat-bubble-left\\">            일반 과정은 총 240시간에서 320시간의 교육을 이수해야 합니다. 간호사나 사회복지사 자격증 소지자는 단축 과정(40~50시간) 이수가 가능합니다.        </p>\\n</div>\\n</div>\\n<!-- 질문 -->\\n<div class=\\"chat-line chat-right\\">\\n<div>\\n<h3 class=\\"chat-bubble chat-bubble-right\\">            요양보호사 시험은 어떻게 구성되어 있나요?        </h3>\\n</div>\\n</div>\\n<!-- 답변 -->\\n<div class=\\"chat-line chat-left\\">\\n<div>\\n<p class=\\"chat-bubble chat-bubble-left\\">            요양보호사 시험은 필기시험(35문항)과 실기시험(45문항)으로 구성되어 있으며, 두 과목 모두 100점 만점에 60점 이상을 받아야 합격입니다.        </p>\\n</div>\\n</div>\\n<!-- 질문 -->\\n<div class=\\"chat-line chat-right\\">\\n<div>\\n<h3 class=\\"chat-bubble chat-bubble-right\\">            요양보호사 교육 비용을 지원받을 수 있나요?        </h3>\\n</div>\\n</div>\\n<!-- 답변 -->\\n<div class=\\"chat-line chat-left\\">\\n<div>\\n<p class=\\"chat-bubble chat-bubble-left\\">            네, 국민내일배움카드를 발급받으면 국비 지원을 통해 교육비 부담을 크게 줄일 수 있습니다. 소득 수준이나 고용 상태에 따라 지원 금액은 달라질 수 있습니다.        </p>\\n</div>\\n</div>\\n<!-- 질문 -->\\n<div class=\\"chat-line chat-right\\">\\n<div>\\n<h3 class=\\"chat-bubble chat-bubble-right\\">            요양보호사 취업 전망은 어떤가요?        </h3>\\n</div>\\n</div>\\n<!-- 답변 -->\\n<div class=\\"chat-line chat-left\\">\\n<div>\\n<p class=\\"chat-bubble chat-bubble-left\\">            고령화 사회로 요양 인력 수요가 꾸준히 증가하고 있어 취업 전망이 밝습니다. 요양원, 재가요양센터 등 다양한 곳에서 근무할 수 있으며, 정년 없이 오래 일할 수 있다는            장점이 있습니다.        </p>\\n</div>\\n</div>\\n</div>"
    }
  ]
}
`
