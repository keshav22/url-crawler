import React, { useEffect, useRef, useState } from "react";

import "./App.css";
import { crawlData, crawlDataResponse } from "./utils/types";
import CrawlTable from "./components/crawl-table";
import Login from "./components/login";

var rxUrlValidation =
  /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w\-._~:/?#[\]@!$&'()*+,;=]*)?$/i;

/* Todos ~ ideas that can be implemented but not necessary imp is the main task todos
main
3. Add fuzzy searchbox (not doing)
5. Detailed view - bars or donut chart of internal vs external links, list of broken links (not doing)

ideas
1. Add throttling to action button and reload button such that the ction is only registered once if clicked multiple times. It can also be made disabled change the UI/UX accordingly. (BE checks added hence not adding)
2. Add auto refresh or make it action specific like only to refresh for like 5 times in 5 seconds internval when a new url or reStart of a crawl is initiated such that if data is found the polling stops
3. Do something such that when a new url is added and its gonna go to new page or your current view is in old page - directly go to the page. (not doing_) 
*/

function App() {
  const [url, setUrl] = useState<string>("");
  const [crawlUrlData, setCrawlUrlData] = useState<crawlData[]>([]);
  const [errorMessageUrlInput, setSrrorMessageUrlInput] = useState<string>("");
  const [maxPageCount, setMaxPageCount] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showLoginSection, setShowLoginSection] = useState<boolean>(false);

  const currentCol = useRef("id");
  const currentSortOrder = useRef("ASC");
  const filterVal = useRef("");

  async function fetchCrawledData(
    page: number,
    colName: string = "",
    order: string = "",
    filterVal: string = ""
  ) {
    fetch(
      `${process.env.REACT_APP_BE_URL}/url/crawl-data?page=${page}&order=${order}&colName=${colName}&filterVal=${filterVal}`,
      {
        method: "GET",
        credentials: "include",
      }
    )
      .then((resp: Response) => {
        if (resp.status == 401) {
          setShowLoginSection(true);
          throw new Error(`HTTP error! status: ${resp.status}`);
        }
        return resp.json();
      })
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

    fetch(`${process.env.REACT_APP_BE_URL}/url/crawl`, {
      method: "post",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ url: url.trim() }),
    })
      .then((response: Response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        setUrl("");
        fetchCrawledData(
          currentPage,
          currentCol.current,
          currentSortOrder.current
        );
      })
      .catch((err) => {
        console.error("Fetch error:", err);
      });
  };

  const fetchCrawledDataWithSortParams = (sortCol: string, sort: string) => {
    currentCol.current = sortCol;
    currentSortOrder.current = sort;
    fetchCrawledData(currentPage, sortCol, sort);
  };

  const fetchFilteredValue = (val: string) => {
    filterVal.current = val;
    fetchCrawledData(
      currentPage,
      currentCol.current,
      currentSortOrder.current,
      val
    );
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchCrawledData(
      page,
      currentCol.current,
      currentSortOrder.current,
      filterVal.current
    );
  };

  const handleLogout = () => {
    fetch(`${process.env.REACT_APP_BE_URL}/logout`, {
      method: "get",
      credentials: "include",
    })
      .then((response: Response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        setShowLoginSection(true);
        setCrawlUrlData([]);
        setMaxPageCount(1);
        setCurrentPage(1);
        setUrl("");
      })
      .catch((err) => {
        console.error("Fetch error:", err);
      });
  }

  useEffect(() => {
    fetchCrawledData(currentPage);
  }, []);

  return (
    <div className="App">
      {showLoginSection ? (
        <section className="login-section">
          <Login
            onLoginSuccess={() => {
              fetchCrawledData(
                currentPage,
                currentCol.current,
                currentSortOrder.current
              );
              setShowLoginSection(false);
            }}
          />
        </section>
      ) : (
        <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
      )}

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
              data-testid="url-input"
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

          <button data-testid="crawl-btn" className="submit-btn" onClick={submit}>
            Crawl
          </button>
        </div>
        <CrawlTable
          crawlUrlData={crawlUrlData}
          maxPageCount={maxPageCount}
          onPageChange={handlePageChange}
          isLoggedIn={!showLoginSection}
          reFetchCrawlDatas={() =>
            fetchCrawledData(
              currentPage,
              currentCol.current,
              currentSortOrder.current,
              filterVal.current
            )
          }
          reFetchWithSortParams={fetchCrawledDataWithSortParams}
          reFetchWithFilteredValue={fetchFilteredValue}
        />
      </div>
    </div>
  );
}

export default App;
