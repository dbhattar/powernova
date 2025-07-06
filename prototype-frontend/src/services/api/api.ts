import axios from "axios";
import { getRemoteUrl } from "./urls";

export const api = axios.create({
  baseURL: getRemoteUrl(),
});
