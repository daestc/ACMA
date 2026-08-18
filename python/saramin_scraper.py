import os
import time
import random
import requests
import re
from bs4 import BeautifulSoup
from pymongo import MongoClient
from dotenv import load_dotenv
from datetime import datetime

# 환경변수 및 몽고DB 연결
load_dotenv()
db_uri = os.getenv('MONGODB_URI')

if not db_uri:
    raise ValueError(".env 파일에 MONGODB_URI가 설정되어 있지 않습니다!")

# 클라이언트 연결 및 DB/컬렉션 세팅
client = MongoClient(db_uri)
db = client['jolP']
collection = db['Recruits']

# 실행하자마자 기존 데이터 초기화 
collection.delete_many({}) 
print(" 기존 데이터 초기화 완료!")

MAIN_CATEGORIES = [
    {"name": "기획·전략", "code": "16"},
    {"name": "마케팅·홍보·조사", "code": "14"},
    {"name": "회계·세무·재무", "code": "3"},
    {"name": "인사·노무·HRD", "code": "5"},
    {"name": "총무·법무·사무", "code": "4"},
    {"name": "IT개발·데이터", "code": "2"},
    {"name": "디자인", "code": "15"},
    {"name": "영업·판매·무역", "code": "8"},
    {"name": "고객상담·TM", "code": "21"},
    {"name": "구매·자재·물류", "code": "18"},
    {"name": "상품기획·MD", "code": "12"},
    {"name": "운전·운송·배송", "code": "7"},
    {"name": "서비스", "code": "10"},
    {"name": "생산", "code": "11"},
    {"name": "건설·건축", "code": "22"},
    {"name": "의료", "code": "6"},
    {"name": "연구·R&D", "code": "9"},
    {"name": "교육", "code": "19"},
    {"name": "미디어·문화·스포츠", "code": "13"},
    {"name": "금융·보험", "code": "17"},
    {"name": "공공·복지", "code": "20"}
]

# 날짜 변환 함수
def parse_deadline(deadline_str):
    if not deadline_str or "상시" in deadline_str or "채용시" in deadline_str:
        return None
    
    match = re.search(r'(\d{1,2})/(\d{1,2})', deadline_str)
    if match:
        month = int(match.group(1))
        day = int(match.group(2))
        year = datetime.now().year
        return datetime(year, month, day, 23, 59, 59)
    return None

def crawl_massive_jobs():
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en-US;q=0.7'
    }

    total_saved_count = 0

    for cat in MAIN_CATEGORIES:
        print(f"\n [{cat['name']}] 카테고리 수집 시작")
        
        count = 0
        page = 1
        max_items = 300

        while count < max_items:
            target_url = f"https://www.saramin.co.kr/zf_user/search/recruit?cat_mcls={cat['code']}&recruitPage={page}"
            
            try:
                response = requests.get(target_url, headers=headers)
                soup = BeautifulSoup(response.text, 'html.parser')
                items = soup.select('.item_recruit')

                if not items:
                    print(f" [{cat['name']}] 더 이상 공고가 없습니다.")
                    break

                for item in items:
                    if count >= max_items:
                        break

                    company_tag = item.select_one('.corp_name a')
                    title_tag = item.select_one('.job_tit a')
                    deadline_tag = item.select_one('.job_date .date')

                    if company_tag and title_tag:
                        company = company_tag.text.strip()
                        
                        title = title_tag.get('title')
                        if not title:
                            title = title_tag.text.strip()
                        
                        link = f"https://www.saramin.co.kr{title_tag.get('href')}" if title_tag.get('href') else ""
                        deadline = deadline_tag.text.strip() if deadline_tag else ""

                        condition_spans = item.select('.job_condition > span')
                        
                        region = "지역 무관"
                        experience = "경력 무관"
                        education = "학력 무관"

                        if len(condition_spans) > 0:
                            region = condition_spans[0].get_text(strip=True)      # 첫 번째: 지역
                        if len(condition_spans) > 1:
                            experience = condition_spans[1].get_text(strip=True)  # 두 번째: 경력
                        if len(condition_spans) > 2:
                            education = condition_spans[2].get_text(separator="", strip=True) # 세 번째: 학력 (대졸이상 합치기)

                        job_data = {
                            "company": company,
                            "title": title,
                            "url": link,
                            "deadlineText": deadline,
                            "endDate": parse_deadline(deadline),
                            "saraminCategory": cat['name'],
                            "region": region,
                            "experience": experience,
                            "education": education,
                            "acmaCategory": "",
                            "isAiProcessed": False,
                            "updatedAt": datetime.utcnow()
                        }

                        collection.update_one(
                            {"url": job_data["url"]},
                            {
                                "$set": job_data,
                                "$setOnInsert": {"createdAt": datetime.utcnow()}
                            },
                            upsert=True
                        )
                        
                        print(f" [저장완료] {company[:10]} | 지역: {region} | 경력: {experience} | 학력: {education}")

                        count += 1
                        total_saved_count += 1

                print(f" [{cat['name']}] {page}페이지 완료 (현재 {count}개)")
                page += 1
                time.sleep(random.uniform(1, 2))

            except Exception as e:
                print(f" 에러 발생: {e}")
                break
                
        print(f" [{cat['name']}] 수집 완료")
        time.sleep(random.uniform(2, 3))

    print(f"\n총 {total_saved_count}개 수집 끝")

if __name__ == "__main__":
    crawl_massive_jobs()