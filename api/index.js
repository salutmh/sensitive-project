const express = require('express');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// 환경변수 로드
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// 의존성 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Supabase 초기화 (환경변수가 있을 때만)
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY &&
  !process.env.SUPABASE_URL.includes('your_') && !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('your_')) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
} else {
  console.warn('⚠️ Supabase 설정이 누락되었거나 플레이스홀더 값입니다. 분석 기록은 저장되지 않습니다.');
}

app.post('/api/analyze', async (req, res) => {
  try {
    const { text } = req.body;

    // 입력값 검증
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({ error: '유효한 텍스트를 입력해주세요.' });
    }

    if (text.length > 1000) {
      return res.status(400).json({ error: '텍스트 길이가 1000자를 초과했습니다.' });
    }

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('your_')) {
      return res.status(500).json({ error: 'OpenAI API 키가 설정되지 않았습니다. 관리자에게 문의하세요.' });
    }

    // OpenAI API 호출
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // gpt-4o-mini 등 다른 모델로 변경 가능
      messages: [
        {
          role: 'system',
          content: '너는 한국어 텍스트 감성 분석기다.\n사용자 텍스트를 positive, negative, neutral 중 하나로 분류한다.\nconfidence는 0부터 100 사이의 정수로 작성한다.\nreason은 한국어로 한 문장만 작성한다.\n과장하지 말고 텍스트 근거만 사용한다.'
        },
        {
          role: 'user',
          content: text
        }
      ],
      // JSON 모드 사용 시 response_format 활용 가능하지만, 
      // 보다 명확한 구조화를 위해 function calling이나 아래와 같은 방식으로 진행.
      // 여기서는 gpt-3.5-turbo 등에서 JSON을 응답받도록 시스템 프롬프트를 강화하고 json_object를 사용합니다.
      // OpenAI SDK 최신 버전에서 구조화된 출력을 위해 아래와 같이 설정 (또는 function calling)
      functions: [
        {
          name: "output_sentiment",
          description: "감성 분석 결과 출력",
          parameters: {
            type: "object",
            properties: {
              sentiment: {
                type: "string",
                enum: ["positive", "negative", "neutral"],
                description: "문장의 감성"
              },
              confidence: {
                type: "integer",
                description: "감성 분류의 신뢰도 (0~100)"
              },
              reason: {
                type: "string",
                description: "분석 이유 (한국어로 1문장)"
              }
            },
            required: ["sentiment", "confidence", "reason"]
          }
        }
      ],
      function_call: { name: "output_sentiment" },
      temperature: 0.1,
    });

    const functionArgs = response.choices[0].message.function_call.arguments;
    const result = JSON.parse(functionArgs);

    // Supabase에 데이터 저장 시도 (실패해도 사용자에게 응답은 정상 반환)
    if (supabase) {
      try {
        const { error } = await supabase
          .from('sentiment_logs')
          .insert([
            {
              input_text: text,
              sentiment: result.sentiment,
              confidence: result.confidence,
              reason: result.reason
            }
          ]);

        if (error) {
          console.error('Supabase 데이터 저장 실패:', error.message);
        }
      } catch (dbError) {
        console.error('Supabase 연동 오류:', dbError);
      }
    }

    // 클라이언트에 결과 반환
    return res.json(result);

  } catch (error) {
    console.error('분석 중 오류 발생:', error);
    return res.status(500).json({ error: '분석 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.' });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
