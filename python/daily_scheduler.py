import schedule
import time
import datetime
from saramin_scraper import crawl_massive_jobs 

def job():
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"\n  {now} - ACMA 데일리 크롤링을 시작합니다")
    
    # 크롤러 실행
    crawl_massive_jobs()
    
    end_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"{end_time} - 데일리 크롤링이 끝났습니다.\n")

#  매일 자정에 크롤러가 돌도록 세팅
schedule.every().day.at("12:00").do(job)


print("ACMA 데일리 크롤러 스케줄러가 가동되었습니다. (종료하려면 터미널에서 Ctrl+C)")


if __name__ == "__main__":
    import datetime
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"\n[{now}] ACMA 데일리 크롤링을 시작합니다 ")
    
    crawl_massive_jobs()
    
    end_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{end_time}] 데일리 크롤링이 성공적으로 끝났습니다. \n")