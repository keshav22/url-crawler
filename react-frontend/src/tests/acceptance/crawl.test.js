import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import App from "../../App";

global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ token: "fake-token" }),
  })
);

describe("Crawl flow", () => {
  test("When user adds a url and does a crawl, a crawl data is added to the table with status running", async () => {
    fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: 1,
                url: "https://wikipedia.com",
                status: "running",
                data: {
                  html_version: "v5",
                  page_title: "wikipedia",
                  heading_counts: {},
                  internal_links: [],
                  external_links: [],
                  inaccessible_links: [],
                  login_form_found: false,
                },
              },
            ],
            pageCount: 3,
          }),
      })
    );

    render(<App />);

    fireEvent.change(screen.getByTestId(/url-input/i), {
      target: { value: "htpps://www.wikipedia.com" },
    });

    fireEvent.click(screen.getByTestId(/crawl-btn/i, { name: /crawl/i }));

    await waitFor(() => {
      expect(screen.getByText(/running/i)).toBeInTheDocument();
    });
  });

  test("When crawl api returns 401, login form is shown", async () => {
    fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
      })
    );

    render(<App />);

    fireEvent.change(screen.getByTestId(/url-input/i), {
      target: { value: "htpps://www.wikipedia.com" },
    });

    fireEvent.click(screen.getByTestId(/crawl-btn/i, { name: /crawl/i }));

    await waitFor(() => {
      expect(screen.getByText(/login/i)).toBeInTheDocument();
    });
  });
});
