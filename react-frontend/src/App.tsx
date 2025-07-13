import React, { useEffect, useRef, useState } from "react";

import "./App.css";
import { crawlData, crawlDataResponse } from "./utils/types";
import CrawlTable from "./components/crawl-table";

var rxUrlValidation =
  /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w\-._~:/?#[\]@!$&'()*+,;=]*)?$/i;

/* Todos ~ ideas that can be implemented but not necessary imp is the main task todos
main
1. Add filters
2. Add table sort via coloumns
3. Add fuzzy searchbox
4. Bulk actions
5. Detailed view - bars or donut chart of internal vs external links, list of broken links 
6. Add delete of crawl data analysis

ideas
1. Add throttling to action button and reload button such that the ction is only registered once if clicked multiple times. It can also be made disabled change the UI/UX accordingly.
2. Add auto refresh or make it action specific like only to refresh for like 5 times in 5 seconds internval when a new url or reStart of a crawl is initiated such that if data is found the polling stops
3. Do something such that when a new url is added and its gonna fo to new page or your current view is in old page - directly go to the page. 
4. Move the api call from "localhost:8080" to env variable and configure it environmentlly
*/

function App() {
  const [url, setUrl] = useState<string>("");
  const [crawlUrlData, setCrawlUrlData] = useState<crawlData[]>([]);
  const [errorMessageUrlInput, setSrrorMessageUrlInput] = useState<string>("");
  const [maxPageCount, setMaxPageCount] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const currentSortCol = useRef("");
  const currentSortOrder = useRef("");

  async function fetchCrawledData(
    page: number,
    srtColName: string = "",
    order: string = ""
  ) {
    fetch(
      `http://localhost:8080/url/crawl-data?page=${page}&order=${order}&srtColName=${srtColName}`
    )
      .then((resp: Response) => resp.json())
      .then((data: crawlDataResponse) => {
        setMaxPageCount(data.pageCount);
        setCrawlUrlData(data.data);
      })
      .catch((err) => {
        console.error("Fetch error:", err);
      });
  }

  const submit = async () => {
    if (!url) {
      setSrrorMessageUrlInput("url is required");
      return;
    }

    if (!rxUrlValidation.test(url)) {
      setSrrorMessageUrlInput("please enter a vaid url");
      return;
    }

    setSrrorMessageUrlInput("");

    fetch("http://localhost:8080/url/crawl", {
      method: "post",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: url.trim() }),
    })
      .then((response: Response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        setUrl("");
        fetchCrawledData(currentPage, currentSortCol.current, currentSortOrder.current);
      })
      .catch((err) => {
        console.error("Fetch error:", err);
      });
  };

  const fetchCrawledDataWithSortParams = (sortCol: string, sort: string) => {
    currentSortCol.current = sortCol;
    currentSortOrder.current = sort;
    fetchCrawledData(currentPage, sortCol, sort);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchCrawledData(page, currentSortCol.current, currentSortOrder.current);
  };

  useEffect(() => {
    fetchCrawledData(currentPage);
  }, []);

  return (
    <div className="App">
      <header>
        <h1 className="heading">URL Crawler</h1>
      </header>
      <div className="container">
        <div className="input-container">
          <div className="w100">
            <input
              id="url-input"
              className="url-input"
              type="text"
              value={url}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setUrl(e.target.value)
              }
              placeholder="https://www.github.com/keshav22"
            />
            {errorMessageUrlInput ? (
              <div className="err-msg-url">{errorMessageUrlInput}</div>
            ) : (
              <></>
            )}
          </div>

          <button className="submit-btn" onClick={submit}>
            Crawl
          </button>
        </div>
        <CrawlTable
          crawlUrlData={crawlUrlData}
          maxPageCount={maxPageCount}
          onPageChange={handlePageChange}
          reFetchCrawlDatas={() => fetchCrawledData(currentPage)}
          reFetchWithSortParams={fetchCrawledDataWithSortParams}
        />
      </div>
    </div>
  );
}

export default App;
