import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import "./crawl-table-th.css";

type ButtonThProps = {
  colName: string;
  handleSortClick: (colName: string) => void;
  reFetchWithFilteredValue: (val: string) => void;
  selectedCol: string;
  sortColoumnOrder: string;
};

function CrawlTableTh({
  colName,
  handleSortClick,
  reFetchWithFilteredValue,
  selectedCol,
  sortColoumnOrder,
}: ButtonThProps) {
  const [openDropdown, setOpenDropdown] = useState<boolean>(false);
  const [distinctValues, setDistinctValues] = useState<string[]>([]);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchDistinctColVals = useCallback((colName: string) => {
    fetch(`${process.env.REACT_APP_BE_URL}/url/crawl/distinct?column=${colName}`, {
      method: "GET",
      credentials: "include",
    })
      .then((response: Response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((valueArray: string[]) => {
        setDistinctValues(valueArray);
        setOpenDropdown(true);
      })
      .catch((err) => {
        console.error("Fetch error:", err);
      });
  }, []);

  const handleFilterBtnClick = () => {
    if (distinctValues.length > 0 && colName == selectedCol) {
      setOpenDropdown(!openDropdown);
      return;
    }
    fetchDistinctColVals(colName);
  };

  const toUpperCamelCase = useCallback((text: string): string => {
    return text
      .replace(/[^a-zA-Z0-9\s_-]/g, "")
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join("");
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div style={{ display: "flex", gap: "4px" }}>
      <button
        className="crawl-table-head-btn"
        style={{ display: "flex", gap: "4px" }}
        onClick={() => handleSortClick(colName)}
      >
        <strong className="th-title">{toUpperCamelCase(colName)}</strong>{" "}
        {selectedCol === colName ? (
          sortColoumnOrder == "DESC" ? (
            <span>&#8593;</span>
          ) : (
            <span>&#8595;</span>
          )
        ) : (
          <></>
        )}
      </button>
      {selectedCol === colName ? (
        <div className="dropdown-wrapper">
          <button
            className="crawl-table-head-btn"
            onClick={handleFilterBtnClick}
            style={{ position: "relative", marginTop: "1px" }}
          >
            <div className="filter-bar">&#x2758;</div>
            <div className="filter-triangle">&#x25BC;</div>
          </button>
          {openDropdown ? (
            <div id="dropdownMenu" ref={dropdownRef} className="dropdown">
              {distinctValues.map((x: string) => (
                <button
                  onClick={() => {
                    reFetchWithFilteredValue(x);
                    setOpenDropdown(false);
                  }}
                  className="dropdown-item"
                >
                  {x}
                </button>
              ))}
            </div>
          ) : (
            <></>
          )}
        </div>
      ) : (
        <></>
      )}
    </div>
  );
}

export default CrawlTableTh;
