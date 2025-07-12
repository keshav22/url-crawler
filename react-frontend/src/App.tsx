import React, { useEffect, useState } from "react";

import "./App.css";
import { crawlData, crawlDataResponse } from "./utils/types";
import CrawlTable from "./components/crawl-table";

var rxUrlValidation =
  /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w\-._~:/?#[\]@!$&'()*+,;=]*)?$/i;

function App() {
  const [url, setUrl] = useState<string>("");
  const [crawlUrlData, setCrawlUrlData] = useState<crawlData[]>([]);
  const [errorMessageUrlInput, setSrrorMessageUrlInput] = useState<string>("");
  const [maxPageCount, setMaxPageCount] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1); 

  async function fetchCrawledData(page: number) {
    fetch(`http://localhost:8080/url/crawl-data?page=${page}`)
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
      body: JSON.stringify({ url: url }),
    })
      .then((response: Response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        setUrl("");
        fetchCrawledData(currentPage);
      })
      .catch((err) => {
        console.error("Fetch error:", err);
      });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchCrawledData(page);
  }

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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setUrl(e.target.value)
              }
              placeholder="https://www.github.com"
            />
            {errorMessageUrlInput ? (
              <div className="err-msg-url">{errorMessageUrlInput}</div>
            ) : <></>}
          </div>

          <button className="submit-btn" onClick={submit}>
            Crawl
          </button>
        </div>
        <CrawlTable crawlUrlData={crawlUrlData} maxPageCount={maxPageCount} onPageChange={handlePageChange}/>
      </div>
    </div>
  );
}

export default App;
