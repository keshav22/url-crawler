package main

import (
	"context"
	"fmt"
	"log"
	"net/url"
	"strings"
	"sync"

	"github.com/gocolly/colly"
)

var crawlCancelMap = make(map[int64]context.CancelFunc)
var crawlCancelLock sync.Mutex

type ScrapeResult struct {
	HTMLVersion       string         `json:"html_version"`
	PageTitle         string         `json:"page_title"`
	HeadingCounts     map[string]int `json:"heading_counts"`
	InternalLinks     []string       `json:"internal_links"`
	ExternalLinks     []string       `json:"external_links"`
	InaccessibleLinks []string       `json:"inaccessible_links"`
	LoginFormFound    bool           `json:"login_form_found"`
}

type Response struct {
	Data ScrapeResult `json:"data"`
}

func crawl(currenturl string, id int64) Response {
	base, err := url.Parse(currenturl)
	if err != nil {
		log.Println(err)
	}

	ctx, cancel := context.WithCancel(context.Background())

	crawlCancelLock.Lock()
	crawlCancelMap[id] = cancel
	crawlCancelLock.Unlock()

	c := colly.NewCollector(
		colly.MaxDepth(1),
		colly.Async(true),
	)

	collyCtx := colly.NewContext()
	collyCtx.Put("ctx", ctx)
	var htmlVersion string
	var pageTitle string
	headingCounts := map[string]int{}
	internalLinks := map[string]struct{}{}
	externalLinks := map[string]struct{}{}
	inaccessibleLinks := map[string]struct{}{}
	loginFormFound := false

	c.OnResponse(func(r *colly.Response) {
		bodyStr := string(r.Body)

		if strings.HasPrefix(strings.ToUpper(bodyStr), "<!DOCTYPE HTML PUBLIC \"-//W3C//DTD HTML 4.01") {
			htmlVersion = "HTML 4.01"
		} else if strings.HasPrefix(strings.ToUpper(bodyStr), "<!DOCTYPE HTML PUBLIC \"-//W3C//DTD XHTML 1.0") {
			htmlVersion = "XHTML 1.0"
		} else if strings.HasPrefix(strings.ToUpper(bodyStr), "<!DOCTYPE HTML>") {
			htmlVersion = "HTML 5"
		} else {
			htmlVersion = "Unknown / Custom DOCTYPE"
		}
	})

	c.OnHTML("title", func(e *colly.HTMLElement) {
		pageTitle = e.Text
	})

	c.OnHTML("h1,h2,h3,h4,h5,h6", func(e *colly.HTMLElement) {
		headingCounts[strings.ToLower(e.Name)]++
	})

	c.OnHTML("a[href]", func(e *colly.HTMLElement) {
		link := e.Attr("href")

		absoluteURL := e.Request.AbsoluteURL(link)
		parsedLink, err := url.Parse(absoluteURL)
		if err != nil {
			return
		}

		if parsedLink.Host == base.Host {
			internalLinks[absoluteURL] = struct{}{}
		} else {
			externalLinks[absoluteURL] = struct{}{}
		}
	})

	c.OnHTML("form", func(e *colly.HTMLElement) {
		if loginFormFound {
			return
		}
		e.ForEach("input[type='password']", func(_ int, _ *colly.HTMLElement) {
			loginFormFound = true
		})
	})

	checker := colly.NewCollector(
		colly.MaxDepth(1),
		colly.Async(true),
	)

	checker.OnResponse(func(r *colly.Response) {
		if r.StatusCode >= 400 {
			inaccessibleLinks[r.Request.URL.String()] = struct{}{}
		}
	})
	checker.OnError(func(r *colly.Response, err error) {
		inaccessibleLinks[r.Request.URL.String()] = struct{}{}
	})

	c.OnScraped(func(r *colly.Response) {
		fmt.Println("Checking accessibility of links, this might take a moment...")
		for link := range internalLinks {
			checker.Request("GET", link, nil, collyCtx, nil)
		}
		for link := range externalLinks {
			checker.Request("GET", link, nil, collyCtx, nil)
		}
	})

	c.Request("GET", currenturl, nil, collyCtx, nil)

	checker.Wait()
	c.Wait()

	cleanUpCrawlId(id)

	internalLinksSlice := make([]string, 0, len(internalLinks))
	for link := range internalLinks {
		internalLinksSlice = append(internalLinksSlice, link)
	}

	externalLinksSlice := make([]string, 0, len(externalLinks))
	for link := range externalLinks {
		externalLinksSlice = append(externalLinksSlice, link)
	}

	inaccessibleLinksSlice := make([]string, 0, len(inaccessibleLinks))
	for link := range inaccessibleLinks {
		inaccessibleLinksSlice = append(inaccessibleLinksSlice, link)
	}

	result := ScrapeResult{
		HTMLVersion:       htmlVersion,
		PageTitle:         pageTitle,
		HeadingCounts:     headingCounts,
		InternalLinks:     internalLinksSlice,
		ExternalLinks:     externalLinksSlice,
		InaccessibleLinks: inaccessibleLinksSlice,
		LoginFormFound:    loginFormFound,
	}

	response := Response{Data: result}
	return response
}

func cleanUpCrawlId(crawlId int64) {
	crawlCancelLock.Lock()
	cancel, ok := crawlCancelMap[crawlId]
	if ok {
		cancel()
		delete(crawlCancelMap, crawlId)
	} else {
		log.Println("Tried canceling already done/cancelled request ?", crawlId)
	}
	crawlCancelLock.Unlock()
}

func checkCrawIdRunning(crawlId int64) bool {
	crawlCancelLock.Lock()
	_, ok := crawlCancelMap[crawlId]
	if ok {
		crawlCancelLock.Unlock()
		return true
	}
	crawlCancelLock.Unlock()
	return false
}
