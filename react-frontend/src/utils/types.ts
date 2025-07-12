export type crawlData = {
  data: {
    external_links: string[];
    heading_counts: any;
    html_version: string;
    inaccessible_links: string[];
    internal_links: string[];
    login_form_found: boolean;
    page_title: string;
  };
  id: number;
  url: string;
};

export type crawlDataResponse = {
  pageCount: number
  data: crawlData[]
};