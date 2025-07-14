import { useCallback, useEffect, useRef, useState } from "react";
import { crawlData } from "../utils/types";
import "./crawl-table.css";
import CrawlTableTh from "./crawl-table-th";

type CrawlTableProps = {
  crawlUrlData: crawlData[];
  maxPageCount: number;
  onPageChange: (page: number) => void;
  reFetchCrawlDatas: () => void;
  reFetchWithSortParams: (sortCol: string, sort: string) => void;
  reFetchWithFilteredValue: (val: string) => void;
};

function CrawlTable({
  crawlUrlData,
  maxPageCount,
  onPageChange,
  reFetchCrawlDatas,
  reFetchWithSortParams,
  reFetchWithFilteredValue,
}: CrawlTableProps) {
  const [showResult, setShowResults] = useState<boolean>(false);
  const [currentPagenumber, setCurrentPagenumber] = useState<number>(1);
  const [selectedColoumn, setSelectedColoumn] = useState<string>("id");
  const [sortColoumnOrder, setSortColoumnOrder] = useState<string>("ASC");

  const [bulkCheckbox, setBulkCheckbox] = useState<boolean>(false);

  const [checkedMap, setCheckedMap] = useState<Record<number, boolean>>({});

  const timeOutId = useRef<number | null>(null);

  const handleReAnalysis = async (
    id: number,
    fetchAfterDone: boolean = true
  ) => {
    const response: Response = await fetch(
      `${process.env.REACT_APP_BE_URL}/url/crawl/reStart`,
      {
        method: "post",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: id.toString(),
      }
    );
    if (!response.ok) {
      if (response.status == 409) {
        alert("Restart failed as similar crawl is running already");
      } else throw new Error(`HTTP error! status: ${response.status}`);
    }
    if (fetchAfterDone) reFetchCrawlDatas();
  };

  const handleDeleteAnalysis = async (
    id: number,
    fetchAfterDone: boolean = true
  ) => {
    const response: Response = await fetch(
      `${process.env.REACT_APP_BE_URL}/url/crawl/delete?crawId=${id}`,
      {
        method: "delete",
        credentials: "include",
      }
    );
    if (!response.ok) {
      if (response.status == 409) {
        console.log("Delete failed");
      } else throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (fetchAfterDone) reFetchCrawlDatas();
  };

  const handleStopAnalysis = (id: number) => {
    fetch(`${process.env.REACT_APP_BE_URL}/url/crawl/stop`, {
      method: "post",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: id.toString(),
    })
      .then((response: Response) => {
        if (!response.ok) {
          if (response.status == 409) {
            alert("Job is stopped/finished already");
          } else throw new Error(`HTTP error! status: ${response.status}`);
        }
        reFetchCrawlDatas();
      })
      .catch((err) => {
        console.error("Fetch error:", err);
      });
  };

  const handleThClick = (colName: string) => {
    let order: string = sortColoumnOrder;
    if (colName == selectedColoumn) {
      order = sortColoumnOrder == "ASC" ? "DESC" : "ASC";
    }

    reFetchWithSortParams(colName, order);

    setSelectedColoumn(colName);
    setSortColoumnOrder(order);
  };

  const handleCheckboxClick = (id: number) => {
    setCheckedMap({
      ...checkedMap,
      [id]: !checkedMap[id],
    });
  };

  const handleBulkCheckboxClick = (checked: boolean) => {
    setBulkCheckbox(true);
    setCheckedMap(
      crawlUrlData.reduce((acc: Record<number, boolean>, crawl: crawlData) => {
        acc[crawl.id] = checked;
        return acc;
      }, {})
    );
  };

  const handleBulkActionDelete = () => {
    if (checkedMap && Object.keys(checkedMap).length == 0) {
      alert("Select some rows first");
      return;
    }

    const deleteIds = Object.keys(checkedMap).filter(
      (x: string) => checkedMap[parseInt(x)]
    );

    const bulkCrawlPromiseArray: Array<Promise<void>> = [];

    deleteIds.forEach((id) => {
      const p = handleDeleteAnalysis(parseInt(id), false);
      bulkCrawlPromiseArray.push(p);
    });

    Promise.all(bulkCrawlPromiseArray).then(() => {
      reFetchCrawlDatas();
      setCheckedMap({});
      setBulkCheckbox(false);
    });
  };

  const handleBulkActionCrawl = () => {
    if (checkedMap && Object.keys(checkedMap).length == 0) {
      alert("Select some rows first");
      return;
    }

    const crawlIds = Object.keys(checkedMap).filter(
      (x: string) => checkedMap[parseInt(x)]
    );
    const bulkCrawlPromiseArray: Array<Promise<void>> = [];

    crawlIds.forEach((id) => {
      const p = handleReAnalysis(parseInt(id), false);
      bulkCrawlPromiseArray.push(p);
    });

    Promise.all(bulkCrawlPromiseArray).then(() => {
      reFetchCrawlDatas();
      setCheckedMap({});
      setBulkCheckbox(false);
    });
  };

  const handlePollingRate = (val: string) => {
    if(timeOutId)
        clearTimeout(timeOutId.current!);

    if(val === "0")
        return;

    const timesIn60secs = parseInt(val);
    const timeoutMiliSecs = 60000 / timesIn60secs; // 1000 * 60

    timeOutId.current = timeoutCall(timeoutMiliSecs);
  };

  const timeoutCall = useCallback((timeoutMiliSecs: number) => {
    const id = setTimeout(() => {
      reFetchCrawlDatas();
      timeOutId.current = timeoutCall(timeoutMiliSecs);
    }, timeoutMiliSecs);
    return id as unknown as number;
  }, []);

  useEffect(() => {
    setCheckedMap({});
    setBulkCheckbox(false);
  }, [currentPagenumber, showResult]);

  return (
    <div className="crawl-table-container">
      <header className="crawl-table-header">
        <div className="crawl-table-h-desc">
          <h3 style={{ margin: 0 }}>
            {showResult ? "Data View" : "URL Management"}
          </h3>
          <button
            className="action-btn refresh-table"
            onClick={() => {
              reFetchCrawlDatas();
            }}
          >
            {" "}
            <img src="/refresh_arrows.svg" width={20} height={20} />
          </button>
          <div className="polling">
            {"Polling "}
            <select
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                handlePollingRate(e.target.value)
              }
            >
              <option value={0} key="manual">
                0
              </option>
              <option value={1} key="1">
                1
              </option>
              <option value={2} key="2">
                3
              </option>
              <option value={5} key="5">
                5
              </option>
              <option value={10} key="10">
                10
              </option>
              <option value={20} key="20">
                20
              </option>
            </select>{" "}
            {" /1 min"}
          </div>
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
            onClick={() => {
              setShowResults(!showResult);
            }}
          >
            Change view
          </button>
        </div>
      </header>
      {showResult ? (
        <></>
      ) : (
        <div className="bulk-action-container">
          <button className="bulk-action-btn" onClick={handleBulkActionDelete}>
            Delete
          </button>
          <button className="bulk-action-btn" onClick={handleBulkActionCrawl}>
            Crawl
          </button>
          {": "} <strong>Bulk actions</strong>
        </div>
      )}
      {showResult ? (
        <table className="crawl-table">
          <thead className="crawl-table-head">
            <tr>
              <th>
                <CrawlTableTh
                  handleSortClick={handleThClick}
                  reFetchWithFilteredValue={reFetchWithFilteredValue}
                  colName="id"
                  selectedCol={selectedColoumn}
                  sortColoumnOrder={sortColoumnOrder}
                />
              </th>
              <th>
                <CrawlTableTh
                  handleSortClick={handleThClick}
                  reFetchWithFilteredValue={reFetchWithFilteredValue}
                  colName="url"
                  selectedCol={selectedColoumn}
                  sortColoumnOrder={sortColoumnOrder}
                />
              </th>
              <th>
                <CrawlTableTh
                  handleSortClick={handleThClick}
                  reFetchWithFilteredValue={reFetchWithFilteredValue}
                  colName="page_title"
                  selectedCol={selectedColoumn}
                  sortColoumnOrder={sortColoumnOrder}
                />
              </th>
              <th>
                <CrawlTableTh
                  handleSortClick={handleThClick}
                  reFetchWithFilteredValue={reFetchWithFilteredValue}
                  colName="html_version"
                  selectedCol={selectedColoumn}
                  sortColoumnOrder={sortColoumnOrder}
                />
              </th>
              <th>Internal links</th>
              <th>External links</th>
              <th>Inaccessible links</th>
              <th>Login form found</th>
              <th>Heading counts</th>
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
              <th>
                <div style={{ display: "flex", gap: "4px" }}>
                  <input
                    checked={bulkCheckbox}
                    type="checkbox"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleBulkCheckboxClick(e.target.checked)
                    }
                  />
                  <CrawlTableTh
                    handleSortClick={handleThClick}
                    reFetchWithFilteredValue={reFetchWithFilteredValue}
                    colName="id"
                    selectedCol={selectedColoumn}
                    sortColoumnOrder={sortColoumnOrder}
                  />
                </div>
              </th>
              <th>
                <CrawlTableTh
                  handleSortClick={handleThClick}
                  reFetchWithFilteredValue={reFetchWithFilteredValue}
                  colName="url"
                  selectedCol={selectedColoumn}
                  sortColoumnOrder={sortColoumnOrder}
                />
              </th>
              <th>Status</th>
              <th style={{ textAlign: "center" }}>Action</th>
            </tr>
          </thead>

          <tbody>
            {crawlUrlData.map((crawl: crawlData, index: number) => (
              <tr key={index}>
                <td>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <input
                      id={crawl.id.toString()}
                      type="checkbox"
                      onClick={() => handleCheckboxClick(crawl.id)}
                      checked={
                        checkedMap[crawl.id] ? checkedMap[crawl.id] : false
                      }
                    />
                    <div>{crawl.id}</div>
                  </div>
                </td>
                <td>{crawl.url}</td>
                <td>{crawl.status}</td>
                <td>
                  <div className="action-btn-container">
                    <button
                      className="action-btn"
                      onClick={async () => {
                        handleReAnalysis(crawl.id);
                        reFetchCrawlDatas();
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
                    <button
                      onClick={() => {
                        handleDeleteAnalysis(crawl.id);
                      }}
                      className="action-btn"
                    >
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
