document.addEventListener('DOMContentLoaded', () => {
    const textInput = document.getElementById('text-input');
    const analyzeBtn = document.getElementById('analyze-btn');
    const errorBox = document.getElementById('error-box');
    const resultCard = document.getElementById('result-card');
    const sentimentResult = document.getElementById('sentiment-result');
    const confidenceResult = document.getElementById('confidence-result');
    const reasonResult = document.getElementById('reason-result');

    // 번역 매핑
    const sentimentMap = {
        'positive': '긍정',
        'negative': '부정',
        'neutral': '중립'
    };

    // UI 초기화 함수
    const resetUI = () => {
        errorBox.classList.add('hidden');
        errorBox.textContent = '';
        resultCard.classList.add('hidden');
    };

    // 에러 표시 함수
    const showError = (message) => {
        errorBox.textContent = message;
        errorBox.classList.remove('hidden');
        resultCard.classList.add('hidden');
    };

    analyzeBtn.addEventListener('click', async () => {
        const text = textInput.value.trim();

        // 입력값 검증
        if (!text) {
            showError('분석할 문장을 입력해주세요.');
            return;
        }

        resetUI();

        // 로딩 상태 처리
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = '분석 중...';

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '분석 중 문제가 발생했습니다.');
            }

            // 결과 렌더링
            sentimentResult.textContent = sentimentMap[data.sentiment] || '알 수 없음';
            confidenceResult.textContent = `${data.confidence}%`;
            reasonResult.textContent = data.reason;

            // 결과에 따라 포인트 컬러 변경 (선택적 UX 개선)
            if (data.sentiment === 'positive') {
                sentimentResult.style.color = '#a8e6cf'; // 밝은 민트/그린
            } else if (data.sentiment === 'negative') {
                sentimentResult.style.color = '#ff8b94'; // 밝은 레드/핑크
            } else {
                sentimentResult.style.color = 'var(--point)'; // 기본 연노랑
            }

            resultCard.classList.remove('hidden');

        } catch (error) {
            showError(error.message || '서버와 통신할 수 없거나 네트워크 오류가 발생했습니다.');
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = '분석하기';
        }
    });
});
