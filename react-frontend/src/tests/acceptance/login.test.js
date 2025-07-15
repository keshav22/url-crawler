import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import Login from "../../components/login";


global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ token: "fake-token" }),
  })
);

describe("Login Flow", () => {
  test("successful login", async () => {
    fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ token: "fake-token" }),
      })
    );

    const onLoginSuccess = jest.fn();

    render(<Login onLoginSuccess={onLoginSuccess} />);
    fireEvent.change(screen.getByTestId(/email/i), {
      target: { value: "test@gmail.com" },
    });

    fireEvent.change(screen.getByTestId(/password/i), {
      target: { value: "test@1234" },
    });

    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(onLoginSuccess).toHaveBeenCalledTimes(1);
    });
  });

  test("unsuccessful login", async () => {
    fetch.mockImplementationOnce(() => Promise.reject("API is down"));

    const onLoginSuccess = jest.fn();

    render(<Login onLoginSuccess={onLoginSuccess} />);
    fireEvent.change(screen.getByTestId(/email/i), {
      target: { value: "test@gmail.com" },
    });

    fireEvent.change(screen.getByTestId(/password/i), {
      target: { value: "test@1234" },
    });

    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  test("When email is invalid, error msg with invalid email is shown", async () => {
    const onLoginSuccess = jest.fn();

    render(<Login onLoginSuccess={onLoginSuccess} />);

    fireEvent.change(screen.getByTestId(/email/i), {
      target: { value: "wrongd.com" },
    });

    fireEvent.change(screen.getByTestId(/password/i), {
      target: { value: "wrongpass" },
    });

    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });
  });
});