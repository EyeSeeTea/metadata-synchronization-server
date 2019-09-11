import express from "express";
import axios from "axios";
import btoa from "btoa";
import { init } from "d2";
import { configure } from "log4js";
import "dotenv/config";

import indexRouter from "./routes";
import Scheduler from "./logic/scheduler";
import Instance from "./models/instance";
import appConfig from "../app-config.json";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initialize express
app.use("/", indexRouter);
app.listen(PORT);
console.log(`Server started on ${PORT}`);

// Workaround: Hide DEBUG logs from appearing in console
console.debug = (): void => {};

configure({
    appenders: { file: { type: "file", filename: "debug.log" } },
    categories: { default: { appenders: ["file"], level: "debug" } },
});

const start = async (): Promise<void> => {
    const {
        encryptionKey = "encryptionKey",
        apiUrl: baseUrl = "https://play.dhis2.org/2.30/api",
        username = "admin",
        password = "district",
    } = appConfig;

    // Login to the attached instance with basic auth
    const authorization = `Basic ${btoa(username + ":" + password)}`;
    const d2 = await init({ baseUrl, headers: { authorization } });
    axios.defaults.headers.common["Authorization"] = authorization;

    Instance.setEncryptionKey(encryptionKey);
    new Scheduler(d2).initialize();
};

start();

export default app;
