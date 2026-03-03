import axios, { type AxiosInstance } from "axios";

export type HttpClient = Pick<AxiosInstance, "get">;

export function createHttpClient(baseURL: string): HttpClient {
  return axios.create({
    baseURL,
    timeout: 12_000,
    headers: {
      "User-Agent": "ruggy-bot/1.0",
      Accept: "application/json",
    },
  });
}

