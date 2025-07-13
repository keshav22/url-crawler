import { useState } from "react";
import { crawlData } from "../utils/types";
import "./crawl-table.css";

type CrawlTableProps = {
  crawlUrlData: crawlData[];
  maxPageCount: number;
  onPageChange: (page: number) => void;
  reFetchCrawlDatas: (page: number) => void;
};

function CrawlTable({
  crawlUrlData,
  maxPageCount,
  onPageChange,
  reFetchCrawlDatas,
}: CrawlTableProps) {
  const [showResult, setShowResults] = useState<boolean>(false);
  const [currentPagenumber, setCurrentPagenumber] = useState<number>(1);

  const handleReAnalysis = (id: number) => {
    fetch("http://localhost:8080/url/crawl/reStart", {
      method: "post",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: id.toString(),
    })
      .then((response: Response) => {
        if (!response.ok) {
          if (response.status == 409) {
            alert("Restart failed as similar crawl is running already");
          } else throw new Error(`HTTP error! status: ${response.status}`);
        }
      })
      .catch((err) => {
        console.error("Fetch error:", err);
      });
  };

  const handleStopAnalysis = (id: number) => {
    fetch("http://localhost:8080/url/crawl/stop", {
      method: "post",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: id.toString(),
    })
      .then((response: Response) => {
        if (!response.ok) {
          if (response.status == 409) {
            alert("Job is stopped/finished already");
          } else throw new Error(`HTTP error! status: ${response.status}`);
        }
      })
      .catch((err) => {
        console.error("Fetch error:", err);
      });
  };

  return (
    <div className="crawl-table-container">
      <div className="crawl-table-header">
        <div className="crawl-table-h-desc">
          <h3>{showResult ? "Data View" : "URL Management"}</h3>
          <button
            className="action-btn refresh-table"
            onClick={() => {
              reFetchCrawlDatas(currentPagenumber);
            }}
          >
            {" "}
            <img src="/refresh_arrows.svg" width={20} height={20} />
          </button>
        </div>
        <div className="table-actions">
          <div>
            <button
              onClick={() => {
                if (currentPagenumber > 1) {
                  setCurrentPagenumber(currentPagenumber - 1);
                  onPageChange(currentPagenumber - 1);
                }
              }}
              className="arrow-btn"
            >
              {"< "}
            </button>{" "}
            {currentPagenumber}{" "}
            <button
              onClick={() => {
                if (currentPagenumber < maxPageCount) {
                  setCurrentPagenumber(currentPagenumber + 1);
                  onPageChange(currentPagenumber + 1);
                }
              }}
              className="arrow-btn"
            >
              {" >"}
            </button>
          </div>
          <button
            className="table-header-btn"
            onClick={() => setShowResults(!showResult)}
          >
            Chage view
          </button>
        </div>
      </div>
      {showResult ? (
        <table className="crawl-table">
          <thead className="crawl-table-head">
            <tr>
              <th>ID</th>
              <th>url</th>
              <th>Title</th>
              <th>Html version</th>
              <th>Internal links</th>
              <th>External links</th>
              <th>Inaccessible links</th>
              <th>Login form found</th>
              <th>Heading counts</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {crawlUrlData.map((crawl: crawlData, index: number) => (
              <tr className="tr-url-data" key={index}>
                <td>{crawl.id}</td>
                <td>{crawl.url}</td>
                <td>{crawl.data.page_title}</td>
                <td>{crawl.data.html_version}</td>
                <td>
                  <div className="cell-content">
                    {crawl.data.internal_links ? (
                      crawl.data.internal_links.map((link) => <div>{link}</div>)
                    ) : (
                      <></>
                    )}
                  </div>
                </td>
                <td>
                  <div className="cell-content">
                    {crawl.data.external_links ? (
                      crawl.data.external_links.map((link) => <div>{link}</div>)
                    ) : (
                      <></>
                    )}
                  </div>
                </td>
                <td>
                  <div className="cell-content">
                    {crawl.data.inaccessible_links ? (
                      crawl.data.inaccessible_links.map((link) => (
                        <div>{link}</div>
                      ))
                    ) : (
                      <></>
                    )}
                  </div>
                </td>

                <td>{crawl.data.login_form_found ? "True" : "False"}</td>
                <td>
                  <div className="cell-content">
                    {crawl.data.heading_counts ? (
                      Object.keys(crawl.data.heading_counts).map((x) => (
                        <div>
                          {x}: {crawl.data.heading_counts[x]}
                        </div>
                      ))
                    ) : (
                      <></>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="crawl-table">
          <thead className="crawl-table-head">
            <tr>
              <th>ID</th>
              <th>Url</th>
              <th>Status</th>
              <th style={{textAlign: "center"}}>Action</th>
            </tr>
          </thead>

          <tbody>
            {crawlUrlData.map((crawl: crawlData, index: number) => (
              <tr key={index}>
                <td>{crawl.id}</td>
                <td>{crawl.url}</td>
                <td>{crawl.status}</td>
                <td>
                  <div className="action-btn-container">
                    <button
                      className="action-btn"
                      onClick={() => {
                        handleReAnalysis(crawl.id);
                      }}
                    >
                      <img src="/refresh_arrows.svg" width={20} height={20} />
                    </button>
                    <button
                      onClick={() => {
                        handleStopAnalysis(crawl.id);
                      }}
                      className="action-btn"
                    >
                      <img src="/stop_icon.svg" width={20} height={20} />
                    </button>
                    <button className="action-btn">
                      <img src="/delete_trash.svg" width={20} height={20} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default CrawlTable;
