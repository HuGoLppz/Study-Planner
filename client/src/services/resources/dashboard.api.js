import { request } from "../http.js";

export const get = (params) =>
  request.get("/dashboard", { params }).then((data) => data.dashboard);
